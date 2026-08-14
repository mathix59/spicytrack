import { Injectable } from "@nestjs/common";
import {
  CreatePullRequestOptions,
  PullRequestResult,
  RepoConnectionInput,
  VcsProvider,
  VcsRepoInfo,
  VcsRequestError,
} from "./vcs-provider.interface";
import { assertAllowedVcsEndpoints } from "./vcs-url-policy";

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
}
