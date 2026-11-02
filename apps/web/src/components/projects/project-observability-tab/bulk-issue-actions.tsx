import { X } from "lucide-react";

import type { OrganizationMemberDto } from "@/generated/api";
import { renderNullableText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

function BulkIssueActions({
  selectedIssueIds,
  isUpdatingStatus,
  isUpdatingAssignee,
  bulkSetStatus,
  bulkAssigneeValue,
  setBulkAssigneeValue,
  bulkSetAssignee,
  members,
  clearSelection,
}: {
  selectedIssueIds: string[];
  isUpdatingStatus: boolean;
  isUpdatingAssignee: boolean;
  bulkSetStatus: (status: string) => Promise<void>;
  bulkAssigneeValue: string;
  setBulkAssigneeValue: (value: string) => void;
  bulkSetAssignee: (assignedUserId: string) => Promise<void>;
  members: OrganizationMemberDto[];
  clearSelection: () => void;
}) {
  if (selectedIssueIds.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Bulk actions"
      className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-card px-3 py-2 shadow-lg"
      role="toolbar"
    >
      <Button
        aria-label="Clear selection"
        onClick={clearSelection}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <X />
      </Button>
      <span className="text-sm font-medium" role="status">
        {selectedIssueIds.length} selected
      </span>
      <Button
        disabled={isUpdatingStatus}
        onClick={() => void bulkSetStatus("resolved")}
        size="sm"
        type="button"
        variant="secondary"
      >
        Resolve
      </Button>
      <Button
        disabled={isUpdatingStatus}
        onClick={() => void bulkSetStatus("ignored")}
        size="sm"
        type="button"
        variant="ghost"
      >
        Ignore
      </Button>
      <Button
        disabled={isUpdatingStatus}
        onClick={() => void bulkSetStatus("open")}
        size="sm"
        type="button"
        variant="ghost"
      >
        Reopen
      </Button>
      <div className="w-full sm:ml-auto sm:w-44">
        <Select
          aria-label="Assign selected issues"
          disabled={isUpdatingAssignee}
          onChange={(event) => {
            setBulkAssigneeValue(event.target.value);
            void bulkSetAssignee(event.target.value === "__unassigned__" ? "" : event.target.value);
          }}
          value={bulkAssigneeValue}
        >
          <option value="__placeholder__">Assign to…</option>
          <option value="__unassigned__">Unassigned</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {renderNullableText(member.name, member.email)}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export { BulkIssueActions };
