import type { GetIssueNeighborsParams } from "@/generated/api";

/**
 * List filters carried from the issue list into an issue's URL, so j/k walk the same list and the
 * breadcrumb returns to it. Same keys and defaults as the list's own URL.
 */
const ISSUE_LIST_CONTEXT_KEYS = [
  "q",
  "status",
  "level",
  "assignedUserId",
  "environment",
  "release",
  "isRegressed",
  "sortBy",
  "sortDir",
] as const;

function issueListContext(searchParams: URLSearchParams) {
  const context = new URLSearchParams();
  for (const key of ISSUE_LIST_CONTEXT_KEYS) {
    const value = searchParams.get(key);
    if (value) context.set(key, value);
  }
  return context;
}

function withIssueListContext(path: string, context: URLSearchParams) {
  const query = context.toString();
  return query ? `${path}?${query}` : path;
}

/** API filters for a list context; the list shows open issues when the URL has no status. */
function issueListContextFilters(context: URLSearchParams): GetIssueNeighborsParams {
  const status = context.get("status") ?? "open";
  const isRegressed = context.get("isRegressed");
  return {
    q: context.get("q") ?? undefined,
    status: status === "all" ? undefined : status,
    level: context.get("level") ?? undefined,
    assignedUserId: context.get("assignedUserId") ?? undefined,
    environment: context.get("environment") ?? undefined,
    release: context.get("release") ?? undefined,
    isRegressed: isRegressed === null ? undefined : isRegressed === "true",
    sortBy: context.get("sortBy") ?? undefined,
    sortDir: context.get("sortDir") ?? undefined,
  };
}

export { issueListContext, issueListContextFilters, withIssueListContext };
