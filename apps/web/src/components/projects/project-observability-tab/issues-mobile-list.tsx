import { Link } from "react-router-dom";

import type { IssueDto, OrganizationMemberDto } from "@/generated/api";
import { IssueStateBadge } from "@/components/issues/issue-status-controls";
import { LevelDot } from "@/components/projects/issue-table-primitives";
import { cn, formatRelativeTime } from "@/lib/utils";

import { RegressionBadge } from "./issue-table-cells";
import { assigneeName } from "./issue-table-utils";

/** The issue list below the `md` breakpoint, as cards instead of table rows. */
function IssuesMobileList({
  issues,
  selectedIssueIdSet,
  toggleIssueSelection,
  issueHref,
  memberByUserId,
}: {
  issues: IssueDto[];
  selectedIssueIdSet: Set<string>;
  toggleIssueSelection: (issueId: string) => void;
  issueHref: (issueId: string) => string;
  memberByUserId: Map<string, OrganizationMemberDto>;
}) {
  return (
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

            <dl className="mt-3 grid grid-cols-4 gap-x-4 border-t border-border pt-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Last seen</dt>
                <dd className="mt-1 text-foreground">{formatRelativeTime(issue.lastSeenAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Events</dt>
                <dd className="mt-1 tabular-nums text-foreground">{String(issue.timesSeen)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Users</dt>
                <dd className="mt-1 tabular-nums text-foreground">
                  {String(issue.userCount ?? 0)}
                </dd>
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
  );
}

export { IssuesMobileList };
