import { useRef } from "react";
import type { MouseEvent } from "react";
import { CheckCircle2, FilterX, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

import type { IssueDto, OrganizationMemberDto } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { IssueStateBadge } from "@/components/issues/issue-status-controls";
import { AssigneeAvatar, LevelDot, SortHeader } from "@/components/projects/issue-table-primitives";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { SkeletonRows } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useHotkeys } from "@/lib/use-hotkeys";
import { cn, formatRelativeTime, renderNullableText } from "@/lib/utils";

type SortKey = "lastSeenAt" | "firstSeenAt" | "timesSeen";

function RegressionBadge() {
  return (
    <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
      regression
    </span>
  );
}

function assigneeName(issue: IssueDto, memberByUserId: Map<string, OrganizationMemberDto>) {
  if (!issue.assignedUserId) return null;
  const member = memberByUserId.get(issue.assignedUserId);
  return renderNullableText(member?.name, member?.email ?? issue.assignedUserId);
}

function isInteractiveTarget(event: MouseEvent) {
  return (event.target as HTMLElement).closest("a, button, input, label") !== null;
}

function IssuesTable({
  issues,
  totalIssues,
  isLoading,
  isFetching,
  error,
  onRetry,
  hasActiveFilters,
  clearFilters,
  issueHref,
  setupHref,
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
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRetry: () => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  issueHref: (issueId: string) => string;
  setupHref: string;
  selectedIssueIdSet: Set<string>;
  toggleVisibleIssues: () => void;
  sortBy: string;
  sortDir: string;
  toggleSort: (value: SortKey) => void;
  navigateToIssue: (issueId: string) => void;
  toggleIssueSelection: (issueId: string) => void;
  memberByUserId: Map<string, OrganizationMemberDto>;
  safePage: number;
  totalIssuePages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  const tableRef = useRef<HTMLDivElement>(null);

  const focusedRowIndex = () => {
    const row = document.activeElement?.closest<HTMLElement>("[data-issue-index]");
    return row && tableRef.current?.contains(row) ? Number(row.dataset.issueIndex) : -1;
  };

  const focusRow = (index: number) => {
    const link = tableRef.current?.querySelector<HTMLAnchorElement>(
      `[data-issue-index="${index}"] a[data-issue-link]`,
    );
    link?.focus();
    link?.scrollIntoView({ block: "nearest" });
  };

  useHotkeys(
    {
      j: () => focusRow(Math.min(issues.length - 1, focusedRowIndex() + 1)),
      k: () => focusRow(Math.max(0, focusedRowIndex() - 1)),
      x: () => {
        const index = focusedRowIndex();
        if (index >= 0 && issues[index]) toggleIssueSelection(issues[index].id);
      },
    },
    issues.length > 0,
  );

  if (isLoading) {
    return <SkeletonRows rows={8} />;
  }

  if (error) {
    return <QueryError error={error} onRetry={onRetry} title="Could not load issues" />;
  }

  if (totalIssues === 0) {
    return hasActiveFilters ? (
      <EmptyState
        action={
          <Button onClick={clearFilters} size="sm" type="button" variant="secondary">
            <FilterX />
            Reset filters
          </Button>
        }
        description="Nothing matches the current search and filters. Broaden them or reset to the default inbox."
        icon={FilterX}
        title="No matching issues"
      />
    ) : (
      <EmptyState
        action={
          <Button asChild size="sm" variant="secondary">
            <Link to={setupHref}>
              <KeyRound />
              View DSN and setup
            </Link>
          </Button>
        }
        description="New errors appear here as soon as your SDK sends them. If this project is new, configure an SDK with its DSN."
        icon={CheckCircle2}
        title="No open issues"
      />
    );
  }

  const allVisibleSelected =
    issues.length > 0 && issues.every((issue) => selectedIssueIdSet.has(issue.id));
  const ariaSort = (key: SortKey) =>
    sortBy === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div
      aria-busy={isFetching}
      className={cn("grid gap-4 transition-opacity", isFetching && "opacity-60")}
    >
      <ul className="grid gap-2 md:hidden">
        {issues.map((issue) => {
          const assignee = assigneeName(issue, memberByUserId);
          return (
            <li
              className={cn(
                "rounded-lg border border-border bg-card p-4",
                issue.isRegressed && "border-l-2 border-l-warning/60",
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
                <Link className="min-w-0 flex-1" to={issueHref(issue.id)}>
                  <span className="flex items-start gap-2">
                    <LevelDot className="mt-1.5" value={issue.level} />
                    <span className="min-w-0 text-sm font-medium leading-5 [overflow-wrap:anywhere]">
                      {issue.title}
                    </span>
                  </span>
                  {issue.culprit ? (
                    <span className="mt-1 block truncate pl-4 text-xs text-muted-foreground">
                      {issue.culprit}
                    </span>
                  ) : null}
                </Link>
              </div>

              {issue.status !== "open" || issue.isRegressed ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-7">
                  {issue.status !== "open" ? <IssueStateBadge value={issue.status} /> : null}
                  {issue.isRegressed ? <RegressionBadge /> : null}
                </div>
              ) : null}

              <dl className="mt-3 grid grid-cols-3 gap-x-4 border-t border-border pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Last seen</dt>
                  <dd className="mt-1 text-foreground">{formatRelativeTime(issue.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Events</dt>
                  <dd className="mt-1 tabular-nums text-foreground">{String(issue.timesSeen)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Assignee</dt>
                  <dd className="mt-1 truncate text-foreground">{assignee ?? "Unassigned"}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      <div
        className="hidden overflow-hidden rounded-lg border border-border md:block"
        ref={tableRef}
      >
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <input
                  aria-label="Select all visible issues"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleIssues}
                  type="checkbox"
                />
              </TableHead>
              <TableHead>Issue</TableHead>
              <TableHead className="w-24">Assignee</TableHead>
              <TableHead aria-sort={ariaSort("lastSeenAt")} className="w-28">
                <SortHeader
                  active={sortBy === "lastSeenAt"}
                  direction={sortDir}
                  label="Last seen"
                  onClick={() => toggleSort("lastSeenAt")}
                />
              </TableHead>
              <TableHead aria-sort={ariaSort("firstSeenAt")} className="hidden w-28 lg:table-cell">
                <SortHeader
                  active={sortBy === "firstSeenAt"}
                  direction={sortDir}
                  label="Age"
                  onClick={() => toggleSort("firstSeenAt")}
                />
              </TableHead>
              <TableHead aria-sort={ariaSort("timesSeen")} className="w-24">
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
            {issues.map((issue, index) => {
              const selected = selectedIssueIdSet.has(issue.id);
              return (
                <TableRow
                  className={cn(
                    "cursor-pointer focus-within:bg-accent/40",
                    selected && "bg-primary/5",
                    issue.isRegressed && "border-l-2 border-l-warning/60",
                  )}
                  data-issue-index={index}
                  key={issue.id}
                  onClick={(event) => {
                    if (!isInteractiveTarget(event)) navigateToIssue(issue.id);
                  }}
                >
                  <TableCell>
                    <input
                      aria-label={`Select issue ${issue.title}`}
                      checked={selected}
                      onChange={() => toggleIssueSelection(issue.id)}
                      type="checkbox"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2.5">
                      <LevelDot className="mt-1.5" value={issue.level} />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            className="truncate text-sm font-medium outline-none hover:underline focus-visible:underline"
                            data-issue-link
                            title={issue.title}
                            to={issueHref(issue.id)}
                          >
                            {issue.title}
                          </Link>
                          {issue.status !== "open" ? (
                            <IssueStateBadge value={issue.status} />
                          ) : null}
                          {issue.isRegressed ? <RegressionBadge /> : null}
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
                    <AssigneeAvatar name={assigneeName(issue, memberByUserId)} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatRelativeTime(issue.lastSeenAt)}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                    {formatRelativeTime(issue.firstSeenAt)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {String(issue.timesSeen)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm text-muted-foreground">
            {totalIssues} issues matching filters · page {safePage} of {totalIssuePages}
          </p>
          <p className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> navigate · <Kbd>x</Kbd> select · <Kbd>Enter</Kbd> open
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={safePage >= totalIssuePages}
            onClick={() => setPage((current) => Math.min(totalIssuePages, current + 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export { IssuesTable };
