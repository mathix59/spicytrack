import { Injectable } from "@nestjs/common";
import {
  COMMIT_FETCH_CONCURRENCY,
  type CommitCheck,
  type CommitChecks,
  type ListCommitsOptions,
  type ListCommitsResult,
  MAX_COMMIT_FILES,
  type VcsCommit,
  type VcsCommitFile,
  assertCommitSha,
  mapLimit,
  CreatePullRequestOptions,
  PullRequestResult,
  RepoConnectionInput,
  VcsProvider,
  VcsRepoInfo,
  VcsRequestError,
  summarizeChecks,
} from "./vcs-provider.interface";
import { assertAllowedVcsEndpoints } from "./vcs-url-policy";

const PASSING_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);

const assertSha = assertCommitSha;

type GithubCommit = {
  sha: string;
  html_url?: string;
  commit: { message: string; author?: { name?: string; email?: string; date?: string } | null };
  author?: { login?: string } | null;
};

type GithubCommitDetail = GithubCommit & {
  files?: Array<{ filename: string; status: string; previous_filename?: string }>;
};

const GITHUB_FILE_STATUS: Record<string, VcsCommitFile["status"]> = {
  added: "added",
  removed: "removed",
  renamed: "renamed",
};

@Injectable()
export class GithubProvider implements VcsProvider {
  private htmlBase(connection: RepoConnectionInput): string {
    return (connection.htmlUrl ?? connection.baseUrl ?? "https://github.com").replace(/\/+$/, "");
  }

  private apiBase(connection: RepoConnectionInput): string {
    if (connection.apiUrl) {
      return connection.apiUrl.replace(/\/+$/, "");
    }

    if (!connection.htmlUrl && !connection.baseUrl) {
      return "https://api.github.com";
    }

    // GitHub Enterprise Server serves its REST API under /api/v3.
    return `${this.htmlBase(connection)}/api/v3`;
  }

  private host(connection: RepoConnectionInput): string {
    return new URL(this.htmlBase(connection)).host;
  }

  private async request<T>(
    connection: RepoConnectionInput,
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    assertAllowedVcsEndpoints("github", connection);
    const response = await fetch(`${this.apiBase(connection)}${path}`, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Accept: "application/vnd.github+json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new VcsRequestError(
        response.status,
        `GitHub API ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`,
      );
    }

    return (await response.json()) as T;
  }

  async validateConnection(connection: RepoConnectionInput): Promise<VcsRepoInfo> {
    const repo = await this.request<{
      default_branch: string;
      html_url: string;
      permissions?: { push?: boolean };
    }>(connection, "GET", `/repos/${connection.repoIdentifier}`);

    return { defaultBranch: repo.default_branch, webUrl: repo.html_url };
  }

  /** False when the repository has GitHub Issues turned off. */
  async issuesEnabled(connection: RepoConnectionInput): Promise<boolean> {
    const repo = await this.request<{ has_issues?: boolean }>(
      connection,
      "GET",
      `/repos/${connection.repoIdentifier}`,
    );
    return repo.has_issues !== false;
  }

  async createIssue(
    connection: RepoConnectionInput,
    issue: { title: string; body: string },
  ): Promise<{ number: number; url: string }> {
    const created = await this.request<{ number: number; html_url: string }>(
      connection,
      "POST",
      `/repos/${connection.repoIdentifier}/issues`,
      { title: issue.title, body: issue.body },
    );
    return { number: created.number, url: created.html_url };
  }

  getAuthenticatedCloneUrl(connection: RepoConnectionInput): string {
    assertAllowedVcsEndpoints("github", connection);
    return `https://x-access-token:${connection.token}@${this.host(connection)}/${connection.repoIdentifier}.git`;
  }

  async createPullRequest(
    connection: RepoConnectionInput,
    options: CreatePullRequestOptions,
  ): Promise<PullRequestResult> {
    const pr = await this.request<{ html_url: string; number: number }>(
      connection,
      "POST",
      `/repos/${connection.repoIdentifier}/pulls`,
      {
        title: options.title,
        head: options.sourceBranch,
        base: options.targetBranch,
        body: options.body,
      },
    );

    return { id: String(pr.number), url: pr.html_url };
  }

  async mergePullRequest(connection: RepoConnectionInput, pullRequestId: string): Promise<void> {
    const pullNumber = Number(pullRequestId);
    if (!Number.isInteger(pullNumber) || pullNumber < 1) {
      throw new VcsRequestError(400, "GitHub pull request number is invalid");
    }

    const result = await this.request<{ merged: boolean; message?: string }>(
      connection,
      "PUT",
      `/repos/${connection.repoIdentifier}/pulls/${pullNumber}/merge`,
      { merge_method: "squash" },
    );
    if (!result.merged) {
      throw new VcsRequestError(409, result.message ?? "GitHub refused to merge the pull request");
    }
  }

  /** Check runs (GitHub Actions, apps) and legacy commit statuses, combined. */
  async getCommitChecks(connection: RepoConnectionInput, sha: string): Promise<CommitChecks> {
    assertSha(sha);
    const commit = `/repos/${connection.repoIdentifier}/commits/${sha}`;
    const [runs, combined] = await Promise.all([
      this.request<{
        check_runs: Array<{ name: string; status: string; conclusion: string | null }>;
      }>(connection, "GET", `${commit}/check-runs?per_page=100`),
      this.request<{ statuses: Array<{ context: string; state: string }> }>(
        connection,
        "GET",
        `${commit}/status?per_page=100`,
      ),
    ]);
    const checks: CommitCheck[] = [
      ...runs.check_runs.map((run) => ({
        name: run.name,
        state:
          run.status !== "completed"
            ? ("pending" as const)
            : PASSING_CONCLUSIONS.has(run.conclusion ?? "")
              ? ("success" as const)
              : ("failure" as const),
      })),
      ...combined.statuses.map((status) => ({
        name: status.context,
        state:
          status.state === "success"
            ? ("success" as const)
            : status.state === "pending"
              ? ("pending" as const)
              : ("failure" as const),
      })),
    ];
    return summarizeChecks(checks);
  }

  /**
   * Commits in base...head (GitHub returns up to 250, oldest first), or the latest ancestors of
   * head without a base. Files come from one request per commit.
   */
  async listCommits(
    connection: RepoConnectionInput,
    options: ListCommitsOptions,
  ): Promise<ListCommitsResult> {
    assertSha(options.head);
    const repo = `/repos/${connection.repoIdentifier}`;
    let listed: GithubCommit[] | null = null;
    let truncated = false;
    let base = options.base;

    if (base) {
      assertSha(base);
      try {
        type Compare = { commits: GithubCommit[]; total_commits: number };
        const comparePath = `${repo}/compare/${base}...${options.head}`;
        const compare = await this.request<Compare>(connection, "GET", comparePath);
        let oldestFirst = compare.commits;
        if (compare.total_commits > compare.commits.length) {
          // Past 250 commits GitHub returns the oldest ones: page from the end for the newest.
          const perPage = Math.min(100, options.limit);
          const lastPage = Math.ceil(compare.total_commits / perPage);
          const page = async (number: number) =>
            (
              await this.request<Compare>(
                connection,
                "GET",
                `${comparePath}?per_page=${perPage}&page=${number}`,
              )
            ).commits;
          const last = await page(lastPage);
          const previous =
            lastPage > 1 && last.length < options.limit ? await page(lastPage - 1) : [];
          oldestFirst = [...previous, ...last];
        }
        listed = [...oldestFirst].reverse();
        truncated = compare.total_commits > options.limit;
      } catch (error) {
        // The previous commit can be gone (force push) or unrelated: fall back to ancestors.
        if (!(error instanceof VcsRequestError) || error.status !== 404) throw error;
        base = null;
      }
    }
    if (!listed) {
      listed = await this.request<GithubCommit[]>(
        connection,
        "GET",
        `${repo}/commits?sha=${options.head}&per_page=${options.limit + 1}`,
      );
      truncated = listed.length > options.limit;
    }

    const commits = await mapLimit(
      listed.slice(0, options.limit),
      COMMIT_FETCH_CONCURRENCY,
      async (commit): Promise<VcsCommit> => {
        const detail = await this.request<GithubCommitDetail>(
          connection,
          "GET",
          `${repo}/commits/${commit.sha}`,
        );
        const files = detail.files ?? [];
        return {
          sha: commit.sha,
          message: commit.commit.message,
          authorName: commit.commit.author?.name ?? null,
          authorEmail: commit.commit.author?.email ?? null,
          authorLogin: commit.author?.login ?? null,
          committedAt: commit.commit.author?.date ?? null,
          url: commit.html_url ?? null,
          files: files.slice(0, MAX_COMMIT_FILES).map((file) => ({
            path: file.filename,
            status: GITHUB_FILE_STATUS[file.status] ?? "modified",
            ...(file.previous_filename ? { previousPath: file.previous_filename } : {}),
          })),
          filesTruncated: files.length > MAX_COMMIT_FILES,
        };
      },
    );
    return { commits, truncated, base };
  }
}
