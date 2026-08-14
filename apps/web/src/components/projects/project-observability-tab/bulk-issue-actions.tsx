import type { OrganizationMemberDto } from "@/generated/api";
import { renderNullableText } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  bulkIssueError,
}: {
  selectedIssueIds: string[];
  isUpdatingStatus: boolean;
  isUpdatingAssignee: boolean;
  bulkSetStatus: (status: string) => Promise<void>;
  bulkAssigneeValue: string;
  setBulkAssigneeValue: (value: string) => void;
  bulkSetAssignee: (assignedUserId: string) => Promise<void>;
  members: OrganizationMemberDto[];
  bulkIssueError: string | null;
}) {
  if (selectedIssueIds.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <span className="text-sm text-muted-foreground">{selectedIssueIds.length} selected</span>
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
      <div className="ml-auto w-44">
        <Select
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
      {bulkIssueError ? (
        <Alert className="w-full" variant="destructive">
          <AlertDescription>{bulkIssueError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export { BulkIssueActions };
