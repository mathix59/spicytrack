import { CircleCheck, CircleX, LoaderCircle } from "lucide-react";

import type { AutofixRunDto } from "@/generated/api";
import { Markdown } from "@/components/common/markdown";
import { Badge } from "@/components/ui/badge";
import { formatLocalDateTime } from "@/lib/utils";

import { CONFIDENCE_VARIANT } from "./autofix-run-utils";

const SCROLL_BOX =
  "mt-1 max-h-72 overflow-auto rounded-md bg-muted/30 p-2 text-xs leading-5 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

function AnalysisPanel({ run }: { run: AutofixRunDto }) {
  const analysis = run.analysis;
  if (!analysis) return null;
  const confidence = analysis.confidence as keyof typeof CONFIDENCE_VARIANT;
  // Region names stay unique when several runs are expanded.
  const when = formatLocalDateTime(run.createdAt);

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={CONFIDENCE_VARIANT[confidence] ?? "muted"}>{confidence} confidence</Badge>
        {analysis.fixable ? null : <Badge variant="warning">Not fixable in this repository</Badge>}
      </div>
      <details className="min-w-0 text-xs text-muted-foreground" open={run.status === "analyzed"}>
        <summary className="cursor-pointer">Root cause</summary>
        {/* Scrollable, so keyboard users can focus and scroll it. */}
        <div
          aria-label={`Root cause, run of ${when}`}
          className={SCROLL_BOX}
          role="region"
          tabIndex={0}
        >
          <Markdown headingLevel={3} source={analysis.rootCause} />
        </div>
      </details>
      <details className="min-w-0 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Proposed fix</summary>
        <div
          aria-label={`Proposed fix, run of ${when}`}
          className={SCROLL_BOX}
          role="region"
          tabIndex={0}
        >
          <Markdown headingLevel={3} source={analysis.proposedFix} />
        </div>
        {analysis.files.length > 0 ? (
          <ul
            aria-label="Files to change"
            className="mt-1 grid gap-0.5 font-mono text-[11px] [overflow-wrap:anywhere]"
          >
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
        <LoaderCircle
          aria-hidden="true"
          className="mt-0.5 size-3.5 shrink-0 motion-safe:animate-spin"
        />
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

export { AnalysisPanel, ChecksPanel };
