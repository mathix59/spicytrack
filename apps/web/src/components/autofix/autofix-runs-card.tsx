import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CircleCheck, CircleX, LoaderCircle, ThumbsDown, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import {
  getListIssueAutofixRunsQueryKey,
  useListIssueAutofixRuns,
  useStartAutofixFix,
} from "@/generated/api";
import type { AutofixRunDto } from "@/generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orvalFetch } from "@/lib/orval-fetch";
import { formatLocalDateTime, getErrorMessage } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["queued", "running", "checking"]);

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  analyzed: "Root cause found",
  checking: "Waiting for CI",
  succeeded: "Pull request opened",
  failed: "Failed",
};

function statusVariant(status: string) {
  if (status === "failed") return "danger" as const;
  if (status === "succeeded") return "success" as const;
  if (status === "analyzed") return "info" as const;
  return "accent" as const;
}

function statusLabel(run: AutofixRunDto) {
  if (run.status === "running" || run.status === "queued") {
    return run.phase === "analysis" ? "Analyzing" : "Writing the fix";
  }
  return STATUS_LABELS[run.status] ?? run.status;
}

const CONFIDENCE_VARIANT = { low: "warning", medium: "info", high: "success" } as const;

function formatCost(micros: number | null | undefined) {
  return micros == null ? null : `$${(micros / 1_000_000).toFixed(micros < 10_000 ? 4 : 2)}`;
}

function AnalysisPanel({ run }: { run: AutofixRunDto }) {
  const analysis = run.analysis;
  if (!analysis) return null;
  const confidence = analysis.confidence as keyof typeof CONFIDENCE_VARIANT;

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={CONFIDENCE_VARIANT[confidence] ?? "muted"}>{confidence} confidence</Badge>
        {analysis.fixable ? null : <Badge variant="warning">Not fixable in this repository</Badge>}
      </div>
      <details className="min-w-0 text-xs text-muted-foreground" open={run.status === "analyzed"}>
        <summary className="cursor-pointer">Root cause</summary>
        <div className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-[11px] leading-5 text-foreground [overflow-wrap:anywhere]">
          {analysis.rootCause}
        </div>
      </details>
      <details className="min-w-0 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Proposed fix</summary>
        <div className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-[11px] leading-5 text-foreground [overflow-wrap:anywhere]">
          {analysis.proposedFix}
        </div>
        {analysis.files.length > 0 ? (
          <ul className="mt-1 grid gap-0.5 font-mono text-[11px] [overflow-wrap:anywhere]">
            {analysis.files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </div>
  );
}

function ChecksPanel({ run }: { run: AutofixRunDto }) {
  const checks = run.checksSummary;
  if (run.status !== "checking" && !checks) return null;

  if (run.status === "checking") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 animate-spin" />
        <span>
          {checks && checks.total > 0
            ? `CI is running on the fix branch (${checks.total - checks.pending.length}/${checks.total} done).`
            : "Waiting for CI to start on the fix branch."}{" "}
          The pull request opens only if it passes.
        </span>
      </p>
    );
  }
  if (!checks) return null;
  if (checks.state === "success") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-success">
        <CircleCheck aria-hidden="true" className="size-3.5" />
        CI passed ({checks.total} check{checks.total === 1 ? "" : "s"})
      </p>
    );
  }
  if (checks.state === "failure") {
    return (
      <p className="flex items-start gap-1.5 text-xs text-destructive">
        <CircleX aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span className="[overflow-wrap:anywhere]">CI failed: {checks.failed.join(", ")}</span>
      </p>
    );
  }
  if (checks.state === "none") {
    return <p className="text-xs text-warning">No CI ran on the fix branch: tests not verified.</p>;
  }
  return null;
}

function RunRow({
  run,
  orgSlug,
  projectSlug,
  issueId,
}: {
  run: AutofixRunDto;
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const queryClient = useQueryClient();
  const runsKey = getListIssueAutofixRunsQueryKey(orgSlug, projectSlug, issueId);
  const isActive = ACTIVE_STATUSES.has(run.status);
  const reviewStatus = run.reviewStatus ?? "pending";
  const cost = formatCost(run.estimatedCostMicros);
  const canGenerateFix =
    Boolean(run.analysis) &&
    (run.status === "analyzed" || (run.phase === "fix" && run.status === "failed"));
  const review = useMutation({
    mutationFn: (status: "approved" | "rejected") =>
      orvalFetch(
        `/organizations/${orgSlug}/projects/${projectSlug}/autofix/runs/${run.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({ status }),
          headers: { "content-type": "application/json" },
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runsKey }),
  });
  const startFix = useStartAutofixFix({
    mutation: {
      onSuccess: () => {
        toast.success("Generating the fix", {
          description: "A pull request opens once the repository's CI passes on it.",
        });
        return queryClient.invalidateQueries({ queryKey: runsKey });
      },
      onError: (error) =>
        toast.error("Could not generate the fix", { description: getErrorMessage(error) }),
    },
  });

  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Badge
          className={isActive ? "animate-pulse" : undefined}
          variant={statusVariant(run.status)}
        >
          {statusLabel(run)}
        </Badge>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatLocalDateTime(run.createdAt)}
        </span>
      </div>

      <AnalysisPanel run={run} />
      <ChecksPanel run={run} />

      {run.prUrl ? (
        <a
          className="min-w-0 truncate text-xs font-medium text-primary-accent underline underline-offset-2"
          href={run.prUrl}
          rel="noreferrer"
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

      {canGenerateFix ? (
        <div className="grid gap-1.5 border-t border-border pt-2">
          <Button
            disabled={startFix.isPending}
            onClick={() => startFix.mutate({ orgSlug, projectSlug, runId: run.id })}
            size="sm"
            type="button"
            variant={run.analysis?.fixable ? "default" : "outline"}
          >
            {startFix.isPending ? <LoaderCircle className="animate-spin" /> : <WandSparkles />}
            {run.status === "failed" ? "Retry the fix" : "Generate fix"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Pushes a branch, waits for your CI, then opens a pull request if it passes.
          </p>
        </div>
      ) : null}

      {run.status === "succeeded" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
          {reviewStatus === "pending" ? (
            <>
              <Button
                disabled={review.isPending}
                onClick={() => {
                  if (window.confirm("Approve this Autofix proposal for review and merge?"))
                    review.mutate("approved");
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <Check className="size-3.5" /> Approve
              </Button>
              <Button
                disabled={review.isPending}
                onClick={() => {
                  if (window.confirm("Reject this Autofix proposal?")) review.mutate("rejected");
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ThumbsDown className="size-3.5" /> Reject
              </Button>
            </>
          ) : (
            <Badge variant={reviewStatus === "approved" ? "accent" : "muted"}>
              {reviewStatus === "approved" ? "Approved" : "Rejected"}
            </Badge>
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="muted">{run.trigger}</Badge>
        {run.outputTokens != null ? (
          <span>{run.outputTokens.toLocaleString()} output tokens</span>
        ) : null}
        {cost ? <span>· {cost} est.</span> : null}
      </div>
    </div>
  );
}

function AutofixRunsCard({
  orgSlug,
  projectSlug,
  issueId,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const runsQuery = useListIssueAutofixRuns(orgSlug, projectSlug, issueId, {
    query: {
      refetchInterval: (query) =>
        query.state.data?.data.some((run) => ACTIVE_STATUSES.has(run.status)) ? 5000 : false,
    },
  });

  const runs = runsQuery.data?.data ?? [];

  if (runs.length === 0) {
    return null;
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">Autofix</CardTitle>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        {runs.map((run) => (
          <RunRow
            issueId={issueId}
            key={run.id}
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            run={run}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export { AutofixRunsCard };
