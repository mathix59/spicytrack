import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  LoaderCircle,
  RadioTower,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { IssueStateBadge, IssueToneBadge } from "@/components/issues/issue-status-controls";
import { Button } from "@/components/ui/button";

import type { IssueActionsState, IssueNavigation } from "./types";
import { formatTimelineDate } from "./utils";

function IssueDetailHeader({
  orgSlug,
  projectSlug,
  projectName,
  title,
  culprit,
  level,
  status,
  firstSeenAt,
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
  totalEvents: number;
  navigation: IssueNavigation;
  actions: IssueActionsState;
}) {
  return (
    <>
      <PageHeader
        eyebrow={projectName}
        icon={RadioTower}
        title={title}
        description={culprit ?? undefined}
        meta={`${totalEvents} events · first seen ${formatTimelineDate(firstSeenAt)}`}
        actions={
          <>
            <Button asChild size="sm" variant="ghost">
              <Link to={`/orgs/${orgSlug}/projects/${projectSlug}?tab=observability`}>
                <ArrowLeft className="size-4" />
                Back to issues
              </Link>
            </Button>
            {navigation.previousIssue ? (
              <Button asChild size="sm" variant="secondary">
                <Link
                  to={`/orgs/${orgSlug}/projects/${projectSlug}/issues/${navigation.previousIssue.id}`}
                >
                  <ArrowLeft className="size-4" />
                  Previous
                </Link>
              </Button>
            ) : null}
            {navigation.nextIssue ? (
              <Button asChild size="sm" variant="secondary">
                <Link
                  to={`/orgs/${orgSlug}/projects/${projectSlug}/issues/${navigation.nextIssue.id}`}
                >
                  Next
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/15 p-2">
        <div className="flex items-center gap-2 px-1">
          <IssueToneBadge value={level} />
          <IssueStateBadge value={status} />
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center rounded-lg border border-border bg-background p-1 shadow-sm">
          <Button
            className="bg-emerald-700 text-white shadow-none hover:bg-emerald-600"
            disabled={actions.isUpdatingStatus || status === "resolved"}
            onClick={() => void actions.updateStatus("resolved")}
            size="sm"
            type="button"
          >
            <CheckCircle2 />
            Resolve
          </Button>
          <Button
            disabled={actions.isUpdatingStatus || status === "ignored"}
            onClick={() =>
              void actions.updateStatus(
                "ignored",
                new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              )
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            <CircleOff />
            Snooze 24h
          </Button>
          <Button
            disabled={actions.isUpdatingStatus || status === "ignored"}
            onClick={() => void actions.updateStatus("ignored", null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <CircleOff />
            Ignore
          </Button>
          <Button
            disabled={actions.isUpdatingStatus || status === "open"}
            onClick={() => void actions.updateStatus("open")}
            size="sm"
            type="button"
            variant="ghost"
          >
            <RotateCcw />
            Reopen
          </Button>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center rounded-lg border border-violet-500/25 bg-violet-500/5 p-1">
          <Button
            className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white shadow-sm hover:from-violet-600 hover:to-indigo-600"
            disabled={actions.isTriggeringAutofix || actions.autofixInFlight}
            onClick={() => void actions.triggerAutofix()}
            size="sm"
            title="Generate a proposed fix and pull request with AI"
            type="button"
          >
            {actions.autofixInFlight || actions.isTriggeringAutofix ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <WandSparkles />
            )}
            {actions.autofixInFlight
              ? "Autofix running"
              : actions.isTriggeringAutofix
                ? "Starting…"
                : "Run Autofix"}
          </Button>
        </div>
      </div>
    </>
  );
}

export { IssueDetailHeader };
