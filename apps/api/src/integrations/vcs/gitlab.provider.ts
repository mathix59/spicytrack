import { Injectable } from "@nestjs/common";
import {
  COMMIT_FETCH_CONCURRENCY,
  type CommitChecks,
  type ListCommitsOptions,
  type ListCommitsResult,
  MAX_COMMIT_FILES,
  type VcsCommit,
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

const GITLAB_MAX_PAGE = 100;

type GitlabCommit = {
  id: string;
  message: string;
  author_name?: string | null;
  author_email?: string | null;
  committed_date?: string | null;
  web_url?: string | null;
};

type GitlabDiff = {
  old_path: string;
  new_path: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
};

@Injectable()
export class GitlabProvider implements VcsProvider {
  private baseUrl(connection: RepoConnectionInput): string {
    return (connection.baseUrl ?? "https://gitlab.com").replace(/\/+$/, "");
  }

  private projectPath(connection: RepoConnectionInput): string {
    return encodeURIComponent(this.repoIdentifier(connection));
  }

  private repoIdentifier(connection: RepoConnectionInput): string {
    return connection.repoIdentifier.trim().replace(/\.git$/i, "");
  }

  private async request<T>(
    connection: RepoConnectionInput,
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    assertAllowedVcsEndpoints("gitlab", connection);
    const response = await fetch(`${this.baseUrl(connection)}/api/v4${path}`, {
      method,
      redirect: "error",
      headers: {
        "PRIVATE-TOKEN": connection.token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new VcsRequestError(
        response.status,
        `GitLab API ${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`,
      );
    }

    return (await response.json()) as T;
  }

  async validateConnection(connection: RepoConnectionInput): Promise<VcsRepoInfo> {
    const project = await this.request<{
      default_branch: string;
      web_url: string;
    }>(connection, "GET", `/projects/${this.projectPath(connection)}`);

    return { defaultBranch: project.default_branch, webUrl: project.web_url };
  }

  getAuthenticatedCloneUrl(connection: RepoConnectionInput): string {
    assertAllowedVcsEndpoints("gitlab", connection);
    const host = new URL(this.baseUrl(connection)).host;
    return `https://oauth2:${connection.token}@${host}/${this.repoIdentifier(connection)}.git`;
  }

  async createPullRequest(
    connection: RepoConnectionInput,
    options: CreatePullRequestOptions,
  ): Promise<PullRequestResult> {
    const mr = await this.request<{ web_url: string; iid: number }>(
      connection,
      "POST",
      `/projects/${this.projectPath(connection)}/merge_requests`,
      {
        source_branch: options.sourceBranch,
        target_branch: options.targetBranch,
        title: options.title,
        description: options.body,
      },
    );

    return { id: String(mr.iid), url: mr.web_url };
  }

  async mergePullRequest(connection: RepoConnectionInput, pullRequestId: string): Promise<void> {
    const mergeRequestIid = Number(pullRequestId);
    if (!Number.isInteger(mergeRequestIid) || mergeRequestIid < 1) {
      throw new VcsRequestError(400, "GitLab merge request IID is invalid");
    }

    await this.request(
      connection,
      "PUT",
      `/projects/${this.projectPath(connection)}/merge_requests/${mergeRequestIid}/merge`,
      {
        squash: true,
        should_remove_source_branch: true,
      },
    );
  }

  /** The latest pipeline that ran on the commit. */
  async getCommitChecks(connection: RepoConnectionInput, sha: string): Promise<CommitChecks> {
    if (!/^[0-9a-f]{7,64}$/i.test(sha)) throw new VcsRequestError(400, "Commit SHA is invalid");
    const pipelines = await this.request<Array<{ id: number; status: string }>>(
      connection,
      "GET",
      `/projects/${this.projectPath(connection)}/pipelines?sha=${sha}&order_by=id&sort=desc&per_page=1`,
    );
    const latest = pipelines[0];
    // A skipped pipeline ran no job: nothing was verified.
    if (!latest || latest.status === "skipped") return summarizeChecks([]);
    return summarizeChecks([
      {
        name: `Pipeline #${latest.id}`,
        state:
          latest.status === "success"
            ? "success"
            : latest.status === "failed" || latest.status === "canceled"
              ? "failure"
              : "pending",
      },
    ]);
  }

  /** Commits in base..head (compare, oldest first), or the latest ancestors of head. */
  async listCommits(
    connection: RepoConnectionInput,
    options: ListCommitsOptions,
  ): Promise<ListCommitsResult> {
    assertCommitSha(options.head);
    const repository = `/projects/${this.projectPath(connection)}/repository`;
    let listed: GitlabCommit[] | null = null;
    let base = options.base;

    if (base) {
      assertCommitSha(base);
      try {
        const compare = await this.request<{ commits: GitlabCommit[] }>(
          connection,
          "GET",
          `${repository}/compare?from=${base}&to=${options.head}`,
        );
        listed = compare.commits.reverse();
      } catch (error) {
        if (!(error instanceof VcsRequestError) || error.status !== 404) throw error;
        base = null;
      }
    }
    if (!listed) {
      listed = await this.request<GitlabCommit[]>(
        connection,
        "GET",
        `${repository}/commits?ref_name=${options.head}&per_page=${options.limit + 1}`,
      );
    }
    const truncated = listed.length > options.limit;

    const commits = await mapLimit(
      listed.slice(0, options.limit),
      COMMIT_FETCH_CONCURRENCY,
      async (commit): Promise<VcsCommit> => {
        const diffs = await this.request<GitlabDiff[]>(
          connection,
          "GET",
          `${repository}/commits/${commit.id}/diff?per_page=${GITLAB_MAX_PAGE}`,
        );
        return {
          sha: commit.id,
          message: commit.message,
          authorName: commit.author_name ?? null,
          authorEmail: commit.author_email ?? null,
          authorLogin: null,
          committedAt: commit.committed_date ?? null,
          url: commit.web_url ?? null,
          files: diffs.slice(0, MAX_COMMIT_FILES).map((diff) =>
            diff.new_file
              ? { path: diff.new_path, status: "added" as const }
              : diff.deleted_file
                ? { path: diff.old_path, status: "removed" as const }
                : diff.renamed_file
                  ? {
                      path: diff.new_path,
                      status: "renamed" as const,
                      previousPath: diff.old_path,
                    }
                  : { path: diff.new_path, status: "modified" as const },
          ),
          // GitLab pages diffs (100 at most): a full page means there may be more files.
          filesTruncated: diffs.length >= GITLAB_MAX_PAGE,
        };
      },
    );
    return { commits, truncated, base };
  }
}
