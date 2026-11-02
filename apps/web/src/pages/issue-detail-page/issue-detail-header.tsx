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
  orgSlug,
  projectSlug,
  projectName,
  title,
  culprit,
  level,
  status,
  firstSeenAt,
  lastSeenAt,
  totalEvents,
  navigation,
  actions,
}: {
  orgSlug: string;
  projectSlug: string;
  projectName: string;
  title: string;
  culprit: string | null | undefined;
  level: string;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalEvents: number;
  navigation: IssueNavigation;
  actions: IssueActionsState;
}) {
  const issuesPath = `/orgs/${orgSlug}/projects/${projectSlug}`;
  const busy = actions.isUpdatingStatus;
  const autofixBusy = actions.autofixInFlight || actions.isTriggeringAutofix;

  return (
    <header className="grid min-w-0 gap-4 border-b border-border pb-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted-foreground">
          <ol className="flex min-w-0 items-center gap-1.5">
            <li className="min-w-0 truncate">
              <Link className="hover:text-foreground" to={issuesPath}>
                {projectName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link className="hover:text-foreground" to={issuesPath}>
                Issues
              </Link>
            </li>
          </ol>
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <IssueNavButton
            direction="previous"
            href={
              navigation.previousIssue
                ? `${issuesPath}/issues/${navigation.previousIssue.id}`
                : null
            }
          />
          <IssueNavButton
            direction="next"
            href={navigation.nextIssue ? `${issuesPath}/issues/${navigation.nextIssue.id}` : null}
          />
        </div>
      </div>

      <div className="grid min-w-0 gap-2">
        <h1
          className="line-clamp-3 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl"
          title={title}
        >
          {title}
        </h1>
        {culprit ? (
          <p className="truncate font-mono text-sm text-muted-foreground" title={culprit}>
            {culprit}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          <IssueToneBadge value={level} />
          <IssueStateBadge value={status} />
          <span>
            <span className="font-medium tabular-nums text-foreground">{totalEvents}</span>{" "}
            {totalEvents === 1 ? "event" : "events"}
          </span>
          <span title={formatTimelineDate(lastSeenAt)}>
            Last seen <span className="text-foreground">{formatRelativeTime(lastSeenAt)}</span>
          </span>
          <span title={formatTimelineDate(firstSeenAt)}>
            First seen <span className="text-foreground">{formatRelativeTime(firstSeenAt)}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status === "open" ? (
          <Button
            className="bg-success text-background hover:bg-success/90"
            disabled={busy}
            onClick={() => void actions.updateStatus("resolved")}
            size="sm"
            type="button"
          >
            <CheckCircle2 />
            Resolve
          </Button>
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
