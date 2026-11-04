import { useRef } from "react";
import { CheckCircle2, FilterX, KeyRound } from "lucide-react";
import { Link } from "react-router-dom";

import type { IssueDto, OrganizationMemberDto } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { SortHeader } from "@/components/projects/issue-table-primitives";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useHotkeys } from "@/lib/use-hotkeys";
import { cn } from "@/lib/utils";

import { assigneeName } from "./issue-table-utils";
import { IssueTableRow } from "./issue-table-row";
import { IssuesMobileList } from "./issues-mobile-list";
import { IssuesPagination } from "./issues-pagination";

type SortKey = "lastSeenAt" | "firstSeenAt" | "timesSeen";

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
  trendByIssueId,
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
  /** Hourly event counts for the last 24 hours, keyed by issue id. */
  trendByIssueId: Map<string, number[]>;
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
      <IssuesMobileList
        issueHref={issueHref}
        issues={issues}
        memberByUserId={memberByUserId}
        selectedIssueIdSet={selectedIssueIdSet}
        toggleIssueSelection={toggleIssueSelection}
      />

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
              <TableHead className="hidden w-32 xl:table-cell">Last 24h</TableHead>
              <TableHead aria-sort={ariaSort("timesSeen")} className="w-24">
                <SortHeader
                  active={sortBy === "timesSeen"}
                  direction={sortDir}
                  label="Events"
                  onClick={() => toggleSort("timesSeen")}
                  rightAligned
                />
              </TableHead>
              <TableHead className="hidden w-20 text-right lg:table-cell">Users</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue, index) => (
              <IssueTableRow
                assignee={assigneeName(issue, memberByUserId)}
                href={issueHref(issue.id)}
                index={index}
                issue={issue}
                key={issue.id}
                navigateToIssue={navigateToIssue}
                selected={selectedIssueIdSet.has(issue.id)}
                toggleIssueSelection={toggleIssueSelection}
                trend={trendByIssueId.get(issue.id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <IssuesPagination
        safePage={safePage}
        setPage={setPage}
        totalIssuePages={totalIssuePages}
        totalIssues={totalIssues}
      />
    </div>
  );
}

export { IssuesTable };
