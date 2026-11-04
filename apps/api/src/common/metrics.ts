import { createHash, timingSafeEqual } from "node:crypto";

/** Prometheus text format helpers, kept dependency-free. */

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function escapeLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function labelText(names: readonly string[], values: readonly string[], extra = "") {
  const pairs = names.map((name, index) => `${name}="${escapeLabel(values[index] ?? "")}"`);
  if (extra) pairs.push(extra);
  return pairs.length > 0 ? `{${pairs.join(",")}}` : "";
}

type Series = { values: string[]; counts: number[]; sum: number; count: number };

/** A histogram whose label values must come from a small, bounded set. */
export class Histogram<Label extends string> {
  private readonly series = new Map<string, Series>();

  constructor(
    readonly name: string,
    private readonly help: string,
    private readonly labelNames: readonly Label[],
    private readonly buckets: readonly number[] = DEFAULT_BUCKETS,
  ) {}

  observe(labels: Record<Label, string>, seconds: number) {
    const values = this.labelNames.map((name) => labels[name]);
    const key = values.join("\u0000");
    let series = this.series.get(key);
    if (!series) {
      series = { values, counts: this.buckets.map(() => 0), sum: 0, count: 0 };
      this.series.set(key, series);
    }
    this.buckets.forEach((bound, index) => {
      if (seconds <= bound) series.counts[index] += 1;
    });
    series.sum += seconds;
    series.count += 1;
  }

  render(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    const sorted = [...this.series.values()].sort((left, right) =>
      left.values.join(",").localeCompare(right.values.join(",")),
    );
    for (const series of sorted) {
      this.buckets.forEach((bound, index) => {
        lines.push(
          `${this.name}_bucket${labelText(this.labelNames, series.values, `le="${bound}"`)} ${series.counts[index]}`,
        );
      });
      lines.push(
        `${this.name}_bucket${labelText(this.labelNames, series.values, 'le="+Inf"')} ${series.count}`,
        `${this.name}_sum${labelText(this.labelNames, series.values)} ${series.sum}`,
        `${this.name}_count${labelText(this.labelNames, series.values)} ${series.count}`,
      );
    }
    return lines;
  }
}

export function gauge(name: string, help: string, value: number): string[] {
  return [`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${value}`];
}

export function processMetrics(): string[] {
  const memory = process.memoryUsage();
  return [
    ...gauge("spicytrack_process_uptime_seconds", "Process uptime in seconds.", process.uptime()),
    ...gauge(
      "spicytrack_process_resident_memory_bytes",
      "Resident memory size in bytes.",
      memory.rss,
    ),
    ...gauge(
      "spicytrack_process_heap_used_bytes",
      "Used JavaScript heap in bytes.",
      memory.heapUsed,
    ),
  ];
}

/** HTTP latency by route template, so ids in URLs never become label values. */
export const httpRequestDuration = new Histogram(
  "spicytrack_http_request_duration_seconds",
  "HTTP request duration in seconds, by route template.",
  ["method", "route", "status"],
);

export const jobDuration = new Histogram(
  "spicytrack_job_duration_seconds",
  "Background job run time in seconds, by job type and result.",
  ["type", "result"],
  [0.01, 0.05, 0.1, 0.5, 1, 5, 15, 60, 300, 900, 2700],
);

/** Constant-time check of `Authorization: Bearer <token>` against METRICS_TOKEN. */
export function bearerMatches(authorization: string | undefined, token: string): boolean {
  const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(token));
}
