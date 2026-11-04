import { X } from "lucide-react";

import type { OrganizationMemberDto } from "@/generated/api";
import { Button } from "@/components/ui/button";
import { renderNullableText } from "@/lib/utils";

function ActiveFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pr-1 pl-2.5 text-xs">
      {label}
      <button
        aria-label={`Remove filter ${label}`}
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={onRemove}
        type="button"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function ActiveFilterChips({
  members,
  assignedUserFilter,
  updateAssignedUserFilter,
  environmentFilter,
  updateEnvironmentFilter,
  releaseFilter,
  updateReleaseFilter,
  regressedFilter,
  updateRegressedFilter,
  clearIssueFilters,
}: {
  members: OrganizationMemberDto[];
  assignedUserFilter: string;
  updateAssignedUserFilter: (value: string) => void;
  environmentFilter: string;
  updateEnvironmentFilter: (value: string) => void;
  releaseFilter: string;
  updateReleaseFilter: (value: string) => void;
  regressedFilter: string;
  updateRegressedFilter: (value: string) => void;
  clearIssueFilters: () => void;
}) {
  return (
    <div aria-label="Active filters" className="flex flex-wrap items-center gap-1.5" role="group">
      {assignedUserFilter !== "all" ? (
        <ActiveFilterChip
          label={`Assignee: ${
            assignedUserFilter === "__unassigned__"
              ? "Unassigned"
              : (() => {
                  const member = members.find((item) => item.userId === assignedUserFilter);
                  return renderNullableText(member?.name, member?.email ?? assignedUserFilter);
                })()
          }`}
          onRemove={() => updateAssignedUserFilter("all")}
        />
      ) : null}
      {environmentFilter !== "all" ? (
        <ActiveFilterChip
          label={`Environment: ${environmentFilter}`}
          onRemove={() => updateEnvironmentFilter("all")}
        />
      ) : null}
      {releaseFilter !== "all" ? (
        <ActiveFilterChip
          label={`Release: ${releaseFilter}`}
          onRemove={() => updateReleaseFilter("all")}
        />
      ) : null}
      {regressedFilter !== "all" ? (
        <ActiveFilterChip
          label={regressedFilter === "true" ? "Regressed only" : "No regression"}
          onRemove={() => updateRegressedFilter("all")}
        />
      ) : null}
      <Button
        onClick={clearIssueFilters}
        className="h-7 px-2 text-xs"
        size="sm"
        type="button"
        variant="ghost"
      >
        Clear all
      </Button>
    </div>
  );
}

export { ActiveFilterChips };
