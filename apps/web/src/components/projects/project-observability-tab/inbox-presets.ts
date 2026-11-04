type InboxPreset = "incoming" | "unassigned" | "regressed" | "resolved";

const INBOX_PRESETS: { value: InboxPreset; label: string }[] = [
  { value: "incoming", label: "Incoming" },
  { value: "unassigned", label: "Unassigned" },
  { value: "regressed", label: "Regressions" },
  { value: "resolved", label: "Resolved" },
];

function activeInboxPreset({
  statusFilter,
  assignedUserFilter,
  regressedFilter,
  issueSearch,
}: {
  statusFilter: string;
  assignedUserFilter: string;
  regressedFilter: string;
  issueSearch: string;
}): InboxPreset | null {
  if (statusFilter === "resolved") return "resolved";
  if (statusFilter !== "open") return null;
  if (assignedUserFilter === "__unassigned__") return "unassigned";
  if (regressedFilter === "true") return "regressed";
  if (assignedUserFilter === "all" && regressedFilter === "all" && issueSearch.length === 0) {
    return "incoming";
  }
  return null;
}

export { activeInboxPreset, INBOX_PRESETS };
export type { InboxPreset };
