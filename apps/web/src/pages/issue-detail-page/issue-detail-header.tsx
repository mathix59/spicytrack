import {
  BellOff,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import type * as React from "react";
import { Link } from "react-router-dom";

import { IssueStateBadge, IssueToneBadge } from "@/components/issues/issue-status-controls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Sparkline } from "@/components/ui/sparkline";
import { formatRelativeTime } from "@/lib/utils";

import type { IssueActionsState, IssueNavigation } from "./types";
import { formatTimelineDate } from "./utils";

const HOUR = 60 * 60 * 1000;
const SNOOZE_OPTIONS = [
  { label: "For 1 hour", duration: HOUR },
  { label: "For 24 hours", duration: 24 * HOUR },
  { label: "For 7 days", duration: 7 * 24 * HOUR },
] as const;

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
  const busy = actions.isUpdatingStatus;
  const autofixBusy = actions.autofixInFlight || actions.isTriggeringAutofix;

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

      <div className="flex flex-wrap items-center gap-2">
        {status === "open" ? (
          <div className="flex">
            <Button
              className="rounded-r-none"
              disabled={busy}
              onClick={() => void actions.updateStatus("resolved")}
              size="sm"
              type="button"
            >
              <CheckCircle2 />
              Resolve
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="More resolve options"
                  className="rounded-l-none border-l border-primary-foreground/25 px-2"
                  disabled={busy}
                  size="sm"
                  type="button"
                >
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => void actions.updateStatus("resolved")}>
                  <div className="grid gap-0.5">
                    <span>Resolve now</span>
                    <span className="text-xs text-muted-foreground">Reopens on the next event</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void actions.resolveInNextRelease()}>
                  <div className="grid gap-0.5">
                    <span>Resolve in next release</span>
                    <span className="text-xs text-muted-foreground">
                      Ignores events from current releases
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Button
            disabled={busy}
            onClick={() => void actions.updateStatus("open")}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RotateCcw />
            Reopen
          </Button>
        )}
        {status !== "ignored" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={busy} size="sm" type="button" variant="outline">
                <BellOff />
                Ignore
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Snooze</DropdownMenuLabel>
              {SNOOZE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.label}
                  onClick={() =>
                    void actions.updateStatus(
                      "ignored",
                      new Date(Date.now() + option.duration).toISOString(),
                    )
                  }
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void actions.updateStatus("ignored", null)}>
                Until manually reopened
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {busy ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}
        <div className="ml-auto">
          <Button
            className="border-primary/40 text-primary-accent hover:bg-primary/10 hover:text-primary-accent"
            disabled={autofixBusy}
            onClick={() => void actions.triggerAutofix()}
            size="sm"
            title="Generate a proposed fix and pull request with AI"
            type="button"
            variant="outline"
          >
            {autofixBusy ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
            {actions.autofixInFlight
              ? "Autofix running"
              : actions.isTriggeringAutofix
                ? "Starting…"
                : "Run Autofix"}
          </Button>
        </div>
      </div>
    </header>
  );
}

/**
 * Exception titles ("TypeError: Cannot read…") read better as a type eyebrow over the message.
 * The heading's accessible name stays the full title, since the split is only visual.
 */
function IssueTitle({ title }: { title: string }) {
  const match =
    /^([A-Za-z_$][\w$.]*(?:Error|Exception|Warning|Fault|Panic|Rejection)):\s+([\s\S]+)$/.exec(
      title,
    );
  const type = match && match[1].length <= 80 ? match[1] : null;

  return (
    <h1 aria-label={title} className="grid min-w-0 gap-1 [overflow-wrap:anywhere]" title={title}>
      {type && match ? (
        <>
          <span aria-hidden="true" className="font-mono text-sm font-medium text-primary-accent">
            {type}
          </span>
          <span
            aria-hidden="true"
            className="line-clamp-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
          >
            {match[2]}
          </span>
        </>
      ) : (
        <span className="line-clamp-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {title}
        </span>
      )}
    </h1>
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
