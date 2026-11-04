import type { AutofixRunDto } from "@/generated/api";

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

export { ACTIVE_STATUSES, CONFIDENCE_VARIANT, formatCost, statusLabel, statusVariant };
