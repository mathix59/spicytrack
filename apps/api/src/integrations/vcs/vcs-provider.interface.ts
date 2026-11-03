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

export type CheckState = "pending" | "success" | "failure";

export interface CommitCheck {
  name: string;
  state: CheckState;
}

/** CI results reported on one commit. `none` means no CI ran on it (yet). */
export interface CommitChecks {
  state: CheckState | "none";
  total: number;
  failed: string[];
  pending: string[];
}

export function summarizeChecks(checks: CommitCheck[]): CommitChecks {
  const failed = checks.filter((check) => check.state === "failure").map((check) => check.name);
  const pending = checks.filter((check) => check.state === "pending").map((check) => check.name);
  const state =
    checks.length === 0
      ? "none"
      : failed.length > 0
        ? "failure"
        : pending.length > 0
          ? "pending"
          : "success";
  return { state, total: checks.length, failed, pending };
}

export interface VcsProvider {
  validateConnection(connection: RepoConnectionInput): Promise<VcsRepoInfo>;
  getAuthenticatedCloneUrl(connection: RepoConnectionInput): string;
  createPullRequest(
    connection: RepoConnectionInput,
    options: CreatePullRequestOptions,
  ): Promise<PullRequestResult>;
  mergePullRequest(connection: RepoConnectionInput, pullRequestId: string): Promise<void>;
  getCommitChecks(connection: RepoConnectionInput, sha: string): Promise<CommitChecks>;
}

export class VcsRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
