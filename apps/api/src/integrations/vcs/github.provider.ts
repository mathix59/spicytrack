import { Injectable } from "@nestjs/common";
import {
  type CommitCheck,
  type CommitChecks,
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

function assertSha(sha: string) {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) throw new VcsRequestError(400, "Commit SHA is invalid");
}

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
}
