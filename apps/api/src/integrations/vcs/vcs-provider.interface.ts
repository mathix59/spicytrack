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

export interface VcsCommitFile {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  previousPath?: string;
}

export interface VcsCommit {
  sha: string;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  authorLogin: string | null;
  committedAt: string | null;
  url: string | null;
  files: VcsCommitFile[];
  filesTruncated: boolean;
}

export interface ListCommitsOptions {
  head: string;
  /** The previous release's commit. Without it, the latest ancestors of head are listed. */
  base: string | null;
  limit: number;
}

export interface ListCommitsResult {
  /** Newest first. */
  commits: VcsCommit[];
  /** More commits exist in the range than were returned. */
  truncated: boolean;
  /** The base actually used: null when there was none, or the providers could not compare. */
  base: string | null;
}

/** Most files kept per commit: enough for matching stack frames, bounded for storage. */
export const MAX_COMMIT_FILES = 300;
export const COMMIT_FETCH_CONCURRENCY = 5;

export function assertCommitSha(sha: string) {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) throw new VcsRequestError(400, "Commit SHA is invalid");
}

/** Runs `task` over `items` with at most `concurrency` in flight, keeping order. */
export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
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
  listCommits(
    connection: RepoConnectionInput,
    options: ListCommitsOptions,
  ): Promise<ListCommitsResult>;
}

export class VcsRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
