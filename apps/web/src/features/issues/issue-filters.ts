import type { IssueFilterSnapshot } from "@/features/issues/saved-searches";

/** Same cap as the API for bulk actions on every result of a search. */
const MAX_BULK_MATCHING_ISSUES = 5_000;

function pluralizeIssues(count: number) {
  return `${count} ${count === 1 ? "issue" : "issues"}`;
}

/** A positive number from the URL, or the fallback when it is missing or malformed. */
function positiveNumberParam(value: string | null, fallback: number) {
  const parsed = Number(value ?? String(fallback));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * The URL search params for the issue list's filters and page: defaults are left out, and keys
 * that are not filters are kept as they are.
 */
function issueFilterSearchParams(
  searchParams: URLSearchParams,
  filters: IssueFilterSnapshot,
  page: number,
) {
  const nextParams = new URLSearchParams(searchParams);
  const setOrDelete = (key: string, value: string, isDefault: boolean) => {
    if (isDefault) nextParams.delete(key);
    else nextParams.set(key, value);
  };

  // The order matches the order the list has always written its keys in.
  setOrDelete("q", filters.q, filters.q.trim().length === 0);
  setOrDelete("status", filters.status, filters.status === "open");
  setOrDelete("assignedUserId", filters.assignedUserId, filters.assignedUserId === "all");
  setOrDelete("environment", filters.environment, filters.environment === "all");
  setOrDelete("release", filters.release, filters.release === "all");
  setOrDelete("isRegressed", filters.isRegressed, filters.isRegressed === "all");
  setOrDelete("sortBy", filters.sortBy, filters.sortBy === "lastSeenAt");
  setOrDelete("sortDir", filters.sortDir, filters.sortDir === "desc");
  setOrDelete("page", String(page), page <= 1);
  setOrDelete("pageSize", String(filters.pageSize), filters.pageSize === 25);
  setOrDelete("level", filters.level, filters.level === "all");

  return nextParams;
}

export { issueFilterSearchParams, MAX_BULK_MATCHING_ISSUES, pluralizeIssues, positiveNumberParam };
