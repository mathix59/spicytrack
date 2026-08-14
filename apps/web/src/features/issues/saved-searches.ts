export type SavedIssueSearch = {
  id: string;
  name: string;
  filters: IssueFilterSnapshot;
  createdAt: string;
};

export type IssueFilterSnapshot = {
  q: string;
  status: string;
  level: string;
  assignedUserId: string;
  environment: string;
  release: string;
  isRegressed: string;
  sortBy: string;
  sortDir: string;
  pageSize: number;
};

export function describeFilterSnapshot(filters: IssueFilterSnapshot) {
  const parts = [
    filters.q.trim().length > 0 ? `query "${filters.q}"` : null,
    filters.status !== "all" ? filters.status : null,
    filters.level !== "all" ? filters.level : null,
    filters.assignedUserId === "__unassigned__"
      ? "unassigned"
      : filters.assignedUserId !== "all"
        ? "assigned"
        : null,
    filters.environment !== "all" ? `env ${filters.environment}` : null,
    filters.release !== "all" ? `release ${filters.release}` : null,
    filters.isRegressed === "true" ? "regressed" : null,
    `${filters.sortBy} ${filters.sortDir}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function buildSuggestedSavedSearchName(filters: IssueFilterSnapshot) {
  if (filters.assignedUserId === "__unassigned__") return "Unassigned queue";
  if (filters.isRegressed === "true") return "Regressions";
  if (filters.status === "resolved") return "Resolved review";
  if (filters.q.trim().length > 0) return `Search: ${filters.q}`;
  return "Incoming triage";
}
