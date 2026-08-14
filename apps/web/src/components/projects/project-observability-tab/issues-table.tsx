import type { IssueDto, OrganizationMemberDto } from "@/generated/api";
import {
  AssigneeAvatar,
  IssueStateBadge,
  LevelDot,
  SortHeader,
} from "@/components/projects/issue-table-primitives";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatRelativeTime, renderNullableText } from "@/lib/utils";

function IssuesTable({
  issues,
  totalIssues,
  selectedIssueIdSet,
  toggleVisibleIssues,
  sortBy,
  sortDir,
  toggleSort,
  navigateToIssue,
  toggleIssueSelection,
  memberByUserId,
  safePage,
  totalIssuePages,
  setPage,
}: {
  issues: IssueDto[];
  totalIssues: number;
  selectedIssueIdSet: Set<string>;
  toggleVisibleIssues: () => void;
  sortBy: string;
  sortDir: string;
  toggleSort: (value: "lastSeenAt" | "firstSeenAt" | "timesSeen") => void;
  navigateToIssue: (issueId: string) => void;
  toggleIssueSelection: (issueId: string) => void;
  memberByUserId: Map<string, OrganizationMemberDto>;
  safePage: number;
  totalIssuePages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (totalIssues === 0) {
    return (
      <EmptyState
        title="No issues"
        description="No results for the current filters. Send an event or broaden your search."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 md:hidden">
        {issues.map((issue) => {
          const assigneeName = issue.assignedUserId
            ? renderNullableText(
                memberByUserId.get(issue.assignedUserId)?.name,
                memberByUserId.get(issue.assignedUserId)?.email ?? issue.assignedUserId,
              )
            : null;

          return (
            <article
              className={cn(
                "rounded-lg border border-border bg-card p-4",
                issue.isRegressed && "border-l-2 border-l-amber-400/60",
              )}
              key={issue.id}
            >
              <div className="flex items-start gap-3">
                <input
                  aria-label={`Select issue ${issue.title}`}
                  checked={selectedIssueIdSet.has(issue.id)}
                  className="mt-1"
                  onChange={() => toggleIssueSelection(issue.id)}
                  type="checkbox"
                />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigateToIssue(issue.id)}
                  type="button"
                >
                  <span className="flex items-start gap-2">
                    <LevelDot className="mt-1.5" value={issue.level} />
                    <span className="min-w-0 text-sm font-medium leading-5">{issue.title}</span>
                  </span>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                {issue.status !== "open" ? <IssueStateBadge value={issue.status} /> : null}
                {issue.isRegressed ? (
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    regression
                  </span>
                ) : null}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Last seen</dt>
                  <dd className="mt-1 text-foreground">{formatRelativeTime(issue.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Events</dt>
                  <dd className="mt-1 text-foreground">{String(issue.timesSeen)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Assignee</dt>
                  <dd className="mt-1 text-foreground">{assigneeName ?? "Unassigned"}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table className="min-w-[920px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <span className="sr-only">Select issues</span>
                <input
                  aria-label="Select all visible issues"
                  checked={
                    issues.length > 0 && issues.every((issue) => selectedIssueIdSet.has(issue.id))
                  }
                  onChange={toggleVisibleIssues}
                  type="checkbox"
                />
              </TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>
                <SortHeader
                  active={sortBy === "lastSeenAt"}
                  direction={sortDir}
                  label="Last seen"
                  onClick={() => toggleSort("lastSeenAt")}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortBy === "firstSeenAt"}
                  direction={sortDir}
                  label="Age"
                  onClick={() => toggleSort("firstSeenAt")}
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  active={sortBy === "timesSeen"}
                  direction={sortDir}
                  label="Events"
                  onClick={() => toggleSort("timesSeen")}
                  rightAligned
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow
                className={cn(
                  "cursor-pointer",
                  issue.isRegressed && "border-l-2 border-l-amber-400/60",
                )}
                key={issue.id}
                onClick={() => navigateToIssue(issue.id)}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <input
                    aria-label={`Select issue ${issue.title}`}
                    checked={selectedIssueIdSet.has(issue.id)}
                    onChange={() => toggleIssueSelection(issue.id)}
                    type="checkbox"
                  />
                </TableCell>
                <TableCell className="max-w-0 w-full">
                  <div className="flex items-start gap-2.5">
                    <LevelDot className="mt-1.5" value={issue.level} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{issue.title}</span>
                        {issue.status !== "open" ? <IssueStateBadge value={issue.status} /> : null}
                        {issue.isRegressed ? (
                          <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            regression
                          </span>
                        ) : null}
                      </div>
                      {issue.culprit ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {issue.culprit}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <AssigneeAvatar
                    name={
                      issue.assignedUserId
                        ? renderNullableText(
                            memberByUserId.get(issue.assignedUserId)?.name,
                            memberByUserId.get(issue.assignedUserId)?.email ?? issue.assignedUserId,
                          )
                        : null
                    }
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatRelativeTime(issue.lastSeenAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatRelativeTime(issue.firstSeenAt)}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {String(issue.timesSeen)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="text-sm text-muted-foreground">
          {totalIssues} issues matching filters · page {safePage} of {totalIssuePages}
        </p>
        <div className="flex justify-end gap-2">
          <Button
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="sm"
            type="button"
            variant="ghost"
          >
            Previous
          </Button>
          <Button
            disabled={safePage >= totalIssuePages}
            onClick={() => setPage((current) => Math.min(totalIssuePages, current + 1))}
            size="sm"
            type="button"
            variant="ghost"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export { IssuesTable };
