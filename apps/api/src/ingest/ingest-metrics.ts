type Outcome = "accepted" | "dropped" | "rejected";

const counters = new Map<string, number>();

function recordIngestOutcome(outcome: Outcome, reason: string): void {
  const key = `${outcome}:${reason}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

function renderIngestMetrics(): string[] {
  const lines = [
    "# HELP spicytrack_ingest_events_total Ingestion attempts by outcome and reason.",
    "# TYPE spicytrack_ingest_events_total counter",
  ];
  for (const [key, count] of [...counters].sort(([left], [right]) => left.localeCompare(right))) {
    const separator = key.indexOf(":");
    const outcome = key.slice(0, separator);
    const reason = key.slice(separator + 1);
    lines.push(`spicytrack_ingest_events_total{outcome="${outcome}",reason="${reason}"} ${count}`);
  }
  return lines;
}

export { recordIngestOutcome, renderIngestMetrics };
