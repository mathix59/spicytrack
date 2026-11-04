import type { MouseEvent } from "react";
import { Link } from "react-router-dom";

import type { IssueDto } from "@/generated/api";
import { IssueStateBadge } from "@/components/issues/issue-status-controls";
import { AssigneeAvatar, LevelDot } from "@/components/projects/issue-table-primitives";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn, formatRelativeTime } from "@/lib/utils";

import { IssueTrendCell, RegressionBadge } from "./issue-table-cells";

function isInteractiveTarget(event: MouseEvent) {
  return (event.target as HTMLElement).closest("a, button, input, label") !== null;
}

function IssueTableRow({
  issue,
  index,
  selected,
  href,
  assignee,
  trend,
  navigateToIssue,
  toggleIssueSelection,
}: {
  issue: IssueDto;
  index: number;
  selected: boolean;
  href: string;
  assignee: string | null;
  /** Hourly event counts for the last 24 hours. */
  trend: number[] | undefined;
  navigateToIssue: (issueId: string) => void;
  toggleIssueSelection: (issueId: string) => void;
}) {
  return (
    <TableRow
      className={cn(
        "cursor-pointer focus-within:bg-accent/40",
        selected && "bg-primary/5",
        issue.isRegressed && "border-l-2 border-l-warning/60",
      )}
      data-issue-index={index}
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
                to={href}
              >
                {issue.title}
              </Link>
              {issue.status !== "open" ? <IssueStateBadge value={issue.status} /> : null}
              {issue.isRegressed ? <RegressionBadge /> : null}
            </div>
            {issue.culprit ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{issue.culprit}</p>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <AssigneeAvatar name={assignee} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatRelativeTime(issue.lastSeenAt)}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
        {formatRelativeTime(issue.firstSeenAt)}
      </TableCell>
      <TableCell className="hidden xl:table-cell">
        <IssueTrendCell counts={trend} level={issue.level} />
      </TableCell>
      <TableCell className="text-right text-sm font-medium tabular-nums">
        {String(issue.timesSeen)}
      </TableCell>
      <TableCell className="hidden text-right text-sm text-muted-foreground tabular-nums lg:table-cell">
        {String(issue.userCount ?? 0)}
      </TableCell>
    </TableRow>
  );
}

export { IssueTableRow };
