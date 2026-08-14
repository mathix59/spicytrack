export type VcsProviderKind = "github" | "gitlab";

export interface RepoConnectionInput {
  baseUrl: string | null;
  htmlUrl?: string | null;
  apiUrl?: string | null;
  gitUser?: string | null;
  gitPort?: number | null;
  repoIdentifier: string;
  token: string;
}

export interface VcsRepoInfo {
  defaultBranch: string;
  webUrl: string;
}

export interface CreatePullRequestOptions {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  body: string;
}

export interface PullRequestResult {
  id: string;
  url: string;
}

export interface VcsProvider {
  validateConnection(connection: RepoConnectionInput): Promise<VcsRepoInfo>;
  getAuthenticatedCloneUrl(connection: RepoConnectionInput): string;
  createPullRequest(
    connection: RepoConnectionInput,
    options: CreatePullRequestOptions,
  ): Promise<PullRequestResult>;
  mergePullRequest(connection: RepoConnectionInput, pullRequestId: string): Promise<void>;
}

export class VcsRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
