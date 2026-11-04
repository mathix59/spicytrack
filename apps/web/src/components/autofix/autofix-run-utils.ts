import type { AutofixRunDto } from "@/generated/api";

/** Target of the header's "Autofix running" action. */
const AUTOFIX_HEADING_ID = "issue-autofix-heading";

/** Scrolls to the Autofix card and moves focus to its heading. */
function focusAutofixCard() {
  const heading = document.getElementById(AUTOFIX_HEADING_ID);
  if (!heading) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  heading.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  heading.focus({ preventScroll: true });
}

const ACTIVE_STATUSES = new Set(["queued", "running", "checking"]);

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  analyzed: "Root cause found",
  checking: "Waiting for CI",
  succeeded: "Pull request opened",
  failed: "Failed",
};

/** In-progress runs read as information (with a spinner), never as the brand accent. */
function statusVariant(status: string) {
  if (status === "failed") return "danger" as const;
  if (status === "succeeded") return "success" as const;
  if (ACTIVE_STATUSES.has(status)) return "info" as const;
  return "default" as const;
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Started manually",
  auto: "Automatic",
};

function triggerLabel(trigger: string) {
  return TRIGGER_LABELS[trigger] ?? trigger;
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

export {
  ACTIVE_STATUSES,
  AUTOFIX_HEADING_ID,
  CONFIDENCE_VARIANT,
  focusAutofixCard,
  formatCost,
  statusLabel,
  statusVariant,
  triggerLabel,
};
