import { ChevronRight, LoaderCircle } from "lucide-react";

import { useListIssueAutofixRuns } from "@/generated/api";
import type { AutofixRunDto } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocalDateTime, formatRelativeTime } from "@/lib/utils";

import type { AutofixBlocker } from "./autofix-availability";
import { GenerateFixAction, ReviewActions, type RunScope } from "./autofix-run-actions";
import { AnalysisPanel, ChecksPanel } from "./autofix-run-panels";
import {
  ACTIVE_STATUSES,
  AUTOFIX_HEADING_ID,
  formatCost,
  statusLabel,
  statusVariant,
  triggerLabel,
} from "./autofix-run-utils";

function RunStatus({ run }: { run: AutofixRunDto }) {
  const isActive = ACTIVE_STATUSES.has(run.status);
  return (
    <Badge variant={statusVariant(run.status)}>
      {isActive ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : null}
      {statusLabel(run)}
    </Badge>
  );
}

function RunTime({ value }: { value: string }) {
  return (
    <time
      className="shrink-0 text-[11px] text-muted-foreground"
      dateTime={value}
      title={formatLocalDateTime(value)}
    >
      {formatRelativeTime(value)}
    </time>
  );
}

/** How the run started, and its token usage and cost behind a disclosure. */
function RunMeta({ run }: { run: AutofixRunDto }) {
  const cost = formatCost(run.estimatedCostMicros);
  const hasUsage = run.inputTokens != null || run.outputTokens != null || cost !== null;

  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <span>{triggerLabel(run.trigger)}</span>
      {hasUsage ? (
        <details className="min-w-0">
          <summary className="cursor-pointer">Usage</summary>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            {run.inputTokens != null ? (
              <>
                <dt>Input tokens</dt>
                <dd className="tabular-nums">{run.inputTokens.toLocaleString()}</dd>
              </>
            ) : null}
            {run.outputTokens != null ? (
              <>
                <dt>Output tokens</dt>
                <dd className="tabular-nums">{run.outputTokens.toLocaleString()}</dd>
              </>
            ) : null}
            {cost ? (
              <>
                <dt>Estimated cost</dt>
                <dd className="tabular-nums">{cost}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

/** Analysis, CI state, pull request and errors of one run. */
function RunBody({ run }: { run: AutofixRunDto }) {
  return (
    <>
      <AnalysisPanel run={run} />
      <ChecksPanel run={run} />

      {run.prUrl ? (
        <a
          className="min-w-0 truncate text-xs font-medium text-primary-accent underline underline-offset-2"
          href={run.prUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          View pull request
        </a>
      ) : null}
      {run.status === "failed" && run.error ? (
        <details className="min-w-0 max-w-full text-xs text-muted-foreground">
          <summary className="cursor-pointer">Error details</summary>
          <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-[11px] leading-5 text-foreground [overflow-wrap:anywhere]">
            {run.error}
          </pre>
        </details>
      ) : null}
      {run.phase === "fix" && run.summary && run.status !== "running" && run.status !== "queued" ? (
        <details className="min-w-0 max-w-full text-xs text-muted-foreground">
          <summary className="cursor-pointer">Fix summary</summary>
          <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-[11px] leading-5 text-foreground">
            {run.summary}
          </pre>
        </details>
      ) : null}
    </>
  );
}

/** The newest run, expanded, with the actions that apply to it. */
function LatestRun({
  run,
  scope,
  canRun,
  blocker,
}: {
  run: AutofixRunDto;
  scope: RunScope;
  canRun: boolean;
  blocker: AutofixBlocker | null;
}) {
  const canGenerateFix =
    Boolean(run.analysis) &&
    (run.status === "analyzed" || (run.phase === "fix" && run.status === "failed"));

  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <RunStatus run={run} />
        <RunTime value={run.createdAt} />
      </div>
      <RunBody run={run} />
      {canGenerateFix ? <GenerateFixAction blocker={blocker} run={run} scope={scope} /> : null}
      {run.status === "succeeded" ? (
        <ReviewActions canReview={canRun} run={run} scope={scope} />
      ) : null}
      <RunMeta run={run} />
    </div>
  );
}

/** Older runs as one-line rows, each expandable on its own. */
function PreviousRuns({ runs }: { runs: AutofixRunDto[] }) {
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        Previous runs ({runs.length})
      </summary>
      <ul className="mt-2 grid gap-1.5">
        {runs.map((run) => (
          <li className="min-w-0" key={run.id}>
            <details className="group/run min-w-0 rounded-md border border-border">
              <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 px-2 py-1.5 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/run:rotate-90"
                />
                <RunStatus run={run} />
                <span className="ml-auto">
                  <RunTime value={run.createdAt} />
                </span>
              </summary>
              <div className="grid min-w-0 gap-2 border-t border-border p-2">
                <RunBody run={run} />
                {run.status === "succeeded" && run.reviewStatus !== "pending" ? (
                  <p className="text-[11px] text-muted-foreground">
                    {run.reviewStatus === "approved" ? "Approved" : "Rejected"}
                    {run.reviewComment ? `: ${run.reviewComment}` : ""}
                  </p>
                ) : null}
                <RunMeta run={run} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}

function AutofixRunsCard({
  orgSlug,
  projectSlug,
  issueId,
  canRun,
  blocker,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  /** The viewer may start, fix and review runs (project.autofix.run). */
  canRun: boolean;
  /** Why a new run or fix cannot start, or null when it can. */
  blocker: AutofixBlocker | null;
}) {
  const runsQuery = useListIssueAutofixRuns(orgSlug, projectSlug, issueId, {
    query: {
      refetchInterval: (query) =>
        query.state.data?.data.some((run) => ACTIVE_STATUSES.has(run.status)) ? 5000 : false,
    },
  });
  const runs = runsQuery.data?.data ?? [];
  const scope = { orgSlug, projectSlug, issueId };

  if (runsQuery.isLoading) return null;
  // Without runs, the card only helps when the viewer can start one.
  if (!runsQuery.isError && runs.length === 0 && blocker) return null;

  const [latest, ...previous] = runs;

  return (
    <Card className="min-w-0" data-testid="issue-autofix">
      <CardHeader>
        <CardTitle
          className="rounded-sm text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          id={AUTOFIX_HEADING_ID}
          tabIndex={-1}
        >
          Autofix
        </CardTitle>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        {runsQuery.isError ? (
          <QueryError
            error={runsQuery.error}
            onRetry={() => void runsQuery.refetch()}
            title="Could not load Autofix runs"
          />
        ) : latest ? (
          <>
            <LatestRun blocker={blocker} canRun={canRun} run={latest} scope={scope} />
            {previous.length > 0 ? <PreviousRuns runs={previous} /> : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No run yet. Use <span className="font-medium text-foreground">Find root cause</span>{" "}
            above to analyze this issue with AI; nothing changes in your code until you generate a
            fix.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { AutofixRunsCard };
