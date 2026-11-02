import type { AiUsageSummary as AiUsageSummaryData } from "./ai-settings-constants";

function AiUsageSummary({ usage }: { usage: AiUsageSummaryData }) {
  const { totals } = usage;

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-muted/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium">AI usage · last {usage.days} days</span>
        {totals.estimatedCostMicros != null ? (
          <span className="text-sm font-medium">
            ${(totals.estimatedCostMicros / 1_000_000).toFixed(4)} est.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Pricing not configured</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {totals.runs.toLocaleString()} AI run{totals.runs === 1 ? "" : "s"} ·{" "}
        {totals.inputTokens.toLocaleString()} input · {totals.outputTokens.toLocaleString()} output
        · {totals.cacheReadTokens.toLocaleString()} cache read
      </p>
      {totals.estimatedCostMicros == null ? (
        <p className="text-xs text-muted-foreground">
          Set <code>AI_PRICING_JSON</code> on the API to turn token usage into estimated cost.
        </p>
      ) : null}
    </div>
  );
}

export { AiUsageSummary };
