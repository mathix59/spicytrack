import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { Link } from "react-router-dom";

import { IssueStateBadge, IssueToneBadge } from "@/components/issues/issue-status-controls";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Sparkline } from "@/components/ui/sparkline";
import { formatRelativeTime } from "@/lib/utils";

import { IssueStatusActions } from "./issue-status-actions";
import { IssueTitle } from "./issue-title";
import type { IssueActionsState, IssueNavigation } from "./types";
import { formatTimelineDate } from "./utils";

function IssueDetailHeader({
  projectName,
  title,
  culprit,
  level,
  status,
  firstSeenAt,
  lastSeenAt,
  totalEvents,
  userCount,
  resolvedInReleaseVersion,
  trend,
  navigation,
  actions,
}: {
  projectName: string;
  title: string;
  culprit: string | null | undefined;
  level: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalEvents: number;
  userCount: number;
  resolvedInReleaseVersion?: string | null;
  /** Daily event counts for the last 14 days, oldest first; omitted while loading. */
  trend?: number[];
  navigation: IssueNavigation;
  actions: IssueActionsState;
}) {
  return (
    <header className="grid min-w-0 gap-5 border-b border-border pb-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted-foreground">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li className="min-w-0 truncate">
              <Link className="hover:text-foreground" to={navigation.listHref}>
                {projectName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link className="hover:text-foreground" to={navigation.listHref}>
                Issues
              </Link>
            </li>
          </ol>
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <IssueNavButton direction="previous" href={navigation.previousIssueHref} />
          <IssueNavButton direction="next" href={navigation.nextIssueHref} />
        </div>
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <IssueToneBadge value={level} />
          <IssueStateBadge value={status} />
          {status === "resolved" && resolvedInReleaseVersion ? (
            <span className="text-xs text-muted-foreground">
              in the next release after{" "}
              <span className="font-mono text-foreground">{resolvedInReleaseVersion}</span>
            </span>
          ) : null}
        </div>
        <IssueTitle title={title} />
        {culprit ? (
          <p className="truncate font-mono text-sm text-muted-foreground" title={culprit}>
            {culprit}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card shadow-xs sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.6fr)]">
        <IssueStat label="Events">
          <span className="tabular-nums">{totalEvents.toLocaleString()}</span>
        </IssueStat>
        <IssueStat label="Users">
          <span className="tabular-nums">{userCount.toLocaleString()}</span>
        </IssueStat>
        <IssueStat label="Last seen" title={formatTimelineDate(lastSeenAt)}>
          {formatRelativeTime(lastSeenAt)}
        </IssueStat>
        <IssueStat label="First seen" title={formatTimelineDate(firstSeenAt)}>
          {formatRelativeTime(firstSeenAt)}
        </IssueStat>
        <IssueStat label="Last 14 days">
          {trend ? (
            <Sparkline
              className="mt-1 h-7"
              label={`${trend.reduce((sum, count) => sum + count, 0)} events in the last 14 days`}
              tone={level === "fatal" || level === "error" ? "destructive" : "primary"}
              values={trend}
            />
          ) : (
            <span aria-hidden="true" className="mt-1 block h-7 animate-pulse rounded bg-muted" />
          )}
        </IssueStat>
      </dl>

      <IssueStatusActions actions={actions} status={status} />
    </header>
  );
}

function IssueStat({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid content-start gap-0.5 border-border px-4 py-3 not-last:border-r max-sm:nth-[2n]:border-r-0 max-sm:not-last:border-b max-sm:last:col-span-2"
      title={title}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-base font-medium text-foreground">{children}</dd>
    </div>
  );
}

function IssueNavButton({
  direction,
  href,
}: {
  direction: "previous" | "next";
  href: string | null;
}) {
  const label = direction === "previous" ? "Previous issue" : "Next issue";
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  const shortcut = direction === "previous" ? "k" : "j";

  if (!href) {
    return (
      <Button aria-label={label} disabled size="icon-sm" type="button" variant="ghost">
        <Icon />
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="ghost">
      <Link aria-keyshortcuts={shortcut} title={`${label} (${shortcut})`} to={href}>
        {direction === "previous" ? <Icon /> : null}
        <span className="hidden sm:inline">{direction === "previous" ? "Previous" : "Next"}</span>
        <Kbd className="hidden md:inline-flex">{shortcut}</Kbd>
        {direction === "next" ? <Icon /> : null}
      </Link>
    </Button>
  );
}

export { IssueDetailHeader };
