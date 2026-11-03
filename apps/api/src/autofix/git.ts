import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_AUTHOR_NAME = "SpicyTrack Autofix";
const GIT_AUTHOR_EMAIL = "autofix@spicytrack.local";

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME,
      GIT_AUTHOR_EMAIL,
      GIT_COMMITTER_NAME: GIT_AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: GIT_AUTHOR_EMAIL,
    },
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout;
}

export async function shallowClone(
  authenticatedUrl: string,
  cleanUrl: string,
  branch: string,
  targetDir: string,
): Promise<void> {
  await git(".", [
    "clone",
    "--depth",
    "50",
    "--single-branch",
    "--branch",
    branch,
    authenticatedUrl,
    targetDir,
  ]);

  // Keep the token out of .git/config; pushes use the authenticated URL explicitly.
  await git(targetDir, ["remote", "set-url", "origin", cleanUrl]);
}

export async function hasChanges(repoDir: string): Promise<boolean> {
  const status = await git(repoDir, ["status", "--porcelain"]);
  return status.trim().length > 0;
}

/**
 * Stages exactly the given files (those the agent wrote) and commits them. Anything else that
 * changed in the clone, e.g. index files left by tools, stays out of the pull request.
 * Returns false when the files do not differ from the branch.
 */
export async function commitFiles(
  repoDir: string,
  files: string[],
  message: string,
): Promise<boolean> {
  if (files.length === 0) {
    return false;
  }

  await git(repoDir, ["add", "--", ...files]);
  const staged = await git(repoDir, ["diff", "--cached", "--name-only"]);

  if (staged.trim().length === 0) {
    return false;
  }

  await git(repoDir, ["commit", "-m", message]);
  return true;
}

export async function pushBranch(
  repoDir: string,
  authenticatedUrl: string,
  branch: string,
): Promise<void> {
  await git(repoDir, ["checkout", "-b", branch]);
  await git(repoDir, ["push", authenticatedUrl, `HEAD:refs/heads/${branch}`]);
}

export async function headSha(repoDir: string): Promise<string> {
  return (await git(repoDir, ["rev-parse", "HEAD"])).trim();
}

export function scrubSecret(text: string, secret: string): string {
  return secret ? text.replaceAll(secret, "***") : text;
}
