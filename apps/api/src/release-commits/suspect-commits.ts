import type { ReleaseCommitFile } from "../database/schema";

export type SuspectFrame = {
  /** Source-mapped path when available, otherwise the raw filename or absolute path. */
  path: string;
  function: string | null;
  lineno: number | null;
  inApp: boolean | null;
};

export type SuspectCandidate = {
  sha: string;
  committedAt: Date | null;
  files: ReleaseCommitFile[];
};

export type SuspectMatch = {
  path: string;
  function: string | null;
  lineno: number | null;
  /** 0 is the frame that raised the error. */
  depth: number;
};

export type Suspect<T extends SuspectCandidate> = {
  commit: T;
  score: number;
  matches: SuspectMatch[];
};

export const MAX_SUSPECTS = 3;
/** Frames below this depth say little about the cause. */
const MAX_FRAME_DEPTH = 30;

/** Splits a frame or repository path into comparable segments. */
export function pathSegments(value: string): string[] {
  let path = value.replaceAll("\\", "/").split(/[?#]/)[0];
  // Drops a scheme and its host: https://cdn/x, app:///x, and webpack://namespace/x alike.
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*\/?/i, "");
  path = path.replace(/^\[project\]\//, "").replace(/^~\//, "");
  return path.split("/").filter((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function isDependency(segments: string[]) {
  return segments.some(
    (segment) => segment === "node_modules" || segment === "site-packages" || segment === "vendor",
  );
}

/**
 * True when one path ends with the whole of the other: `src/a.ts` matches
 * `apps/web/src/a.ts`, and `/home/ci/repo/apps/api/src/b.ts` matches `apps/api/src/b.ts`.
 * A bare file name only matches a bare file name, so `index.ts` alone never matches.
 */
export function pathsMatch(frame: string[], file: string[]) {
  const shortest = Math.min(frame.length, file.length);
  if (shortest === 0) return false;
  if (shortest === 1 && frame.length !== file.length) return false;
  for (let offset = 1; offset <= shortest; offset += 1) {
    if (frame[frame.length - offset] !== file[file.length - offset]) return false;
  }
  return true;
}

/**
 * Ranks the commits of the issue's release by how closely they touched its stack trace. Frames
 * are given oldest call first, as in the event payload; the last one raised the error. A match
 * on the raising frame weighs most.
 */
export function rankSuspectCommits<T extends SuspectCandidate>(
  frames: SuspectFrame[],
  commits: T[],
  limit = MAX_SUSPECTS,
): Suspect<T>[] {
  const hasInAppFlags = frames.some((frame) => frame.inApp === true);
  const candidates = frames
    .map((frame, index) => ({
      frame,
      depth: frames.length - 1 - index,
      segments: pathSegments(frame.path),
    }))
    .filter(
      ({ frame, depth, segments }) =>
        depth < MAX_FRAME_DEPTH &&
        segments.length > 0 &&
        !isDependency(segments) &&
        (hasInAppFlags ? frame.inApp === true : frame.inApp !== false),
    );
  if (candidates.length === 0) return [];

  const suspects: Suspect<T>[] = [];
  for (const commit of commits) {
    const files = commit.files
      .filter((file) => file.status !== "removed")
      .map((file) => pathSegments(file.path));
    const matches: SuspectMatch[] = [];
    let score = 0;
    for (const { frame, depth, segments } of candidates) {
      const file = files.find((candidate) => pathsMatch(segments, candidate));
      if (!file) continue;
      score += 1 / (depth + 1);
      matches.push({
        path: file.join("/"),
        function: frame.function,
        lineno: frame.lineno,
        depth,
      });
    }
    if (matches.length > 0) suspects.push({ commit, score, matches });
  }

  return suspects
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.commit.committedAt?.getTime() ?? 0) - (left.commit.committedAt?.getTime() ?? 0),
    )
    .slice(0, limit)
    .map((suspect) => ({
      ...suspect,
      score: Math.round(suspect.score * 1000) / 1000,
      matches: suspect.matches.sort((left, right) => left.depth - right.depth),
    }));
}

/** A 40-character hexadecimal version is the commit the release was built from. */
export function commitShaFromVersion(version: string): string | null {
  return /^[0-9a-f]{40}$/i.test(version) ? version.toLowerCase() : null;
}
