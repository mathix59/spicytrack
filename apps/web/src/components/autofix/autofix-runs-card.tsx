import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ThumbsDown } from "lucide-react";

import { getListIssueAutofixRunsQueryKey, useListIssueAutofixRuns } from "@/generated/api";
import type { AutofixRunDto } from "@/generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orvalFetch } from "@/lib/orval-fetch";
import { formatLocalDateTime } from "@/lib/utils";

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function statusVariant(status: string) {
  if (status === "failed") {
    return "border-destructive/40 bg-destructive/10 text-red-300";
  }

  if (status === "succeeded") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }

  return "border-primary/30 bg-primary/10 text-primary-accent";
}

type ReviewableRun = AutofixRunDto & {
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewComment?: string | null;
  estimatedCostMicros?: number | null;
};

function RunRow({
  run,
  orgSlug,
  projectSlug,
  issueId,
}: {
  run: ReviewableRun;
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const queryClient = useQueryClient();
  const isActive = run.status === "queued" || run.status === "running";
  const prUrl = asOptionalString(run.prUrl);
  const error = asOptionalString(run.error);
  const summary = asOptionalString(run.summary);
  const outputTokens = asOptionalNumber(run.outputTokens);
  const reviewStatus = run.reviewStatus ?? "pending";
  const cost = asOptionalNumber(run.estimatedCostMicros);
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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: getListIssueAutofixRunsQueryKey(orgSlug, projectSlug, issueId),
      }),
  });

  return (
    <div className="grid min-w-0 gap-1.5 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${statusVariant(run.status)} ${isActive ? "animate-pulse" : ""}`}
        >
          {run.status}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {formatLocalDateTime(run.createdAt)}
        </span>
      </div>
      {prUrl ? (
        <a
          className="min-w-0 truncate text-xs font-medium text-primary underline underline-offset-2"
          href={prUrl}
          rel="noreferrer"
          target="_blank"
        >
          View pull request
        </a>
      ) : null}
      {run.status === "failed" && error ? (
        <details className="min-w-0 max-w-full text-xs text-muted-foreground">
          <summary className="cursor-pointer">Error details</summary>
          <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre rounded-md bg-muted/30 p-2 text-[11px] leading-5 text-foreground">
            {error}
          </pre>
        </details>
      ) : null}
      {run.status === "succeeded" && summary ? (
        <details className="min-w-0 max-w-full text-xs text-muted-foreground">
          <summary className="cursor-pointer">Fix summary</summary>
          <pre className="mt-1 max-w-full overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/30 p-2 text-[11px] leading-5 text-foreground">
            {summary}
          </pre>
        </details>
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
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="muted">{run.trigger}</Badge>
        {outputTokens != null ? <span>{outputTokens.toLocaleString()} output tokens</span> : null}
        {cost != null ? <span>· ${(cost / 1_000_000).toFixed(4)} est.</span> : null}
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
        query.state.data?.data.some((run) => run.status === "queued" || run.status === "running")
          ? 5000
          : false,
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
