import { Sparkline } from "@/components/ui/sparkline";

function RegressionBadge() {
  return (
    <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
      regression
    </span>
  );
}

function IssueTrendCell({ counts, level }: { counts?: number[]; level: string }) {
  if (!counts) {
    return <span aria-hidden="true" className="block h-6 rounded bg-muted/60" />;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    <Sparkline
      className="h-6"
      label={`${total} ${total === 1 ? "event" : "events"} in the last 24 hours`}
      tone={
        total === 0 ? "muted" : level === "fatal" || level === "error" ? "destructive" : "primary"
      }
      values={counts}
    />
  );
}

export { IssueTrendCell, RegressionBadge };
