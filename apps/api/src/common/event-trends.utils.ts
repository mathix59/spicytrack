import { sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

type EventTrendPeriod = "24h" | "14d";

type EventTrendWindow = {
  period: EventTrendPeriod;
  bucketSeconds: number;
  bucketCount: number;
  start: Date;
  end: Date;
};

type EventTrendBucketRow = {
  bucket: number | null;
  count: number;
};

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

const EVENT_TREND_PERIODS: Record<
  EventTrendPeriod,
  { bucketSeconds: number; bucketCount: number }
> = {
  "24h": { bucketSeconds: HOUR_SECONDS, bucketCount: 24 },
  "14d": { bucketSeconds: DAY_SECONDS, bucketCount: 14 },
};

function isEventTrendPeriod(value: string): value is EventTrendPeriod {
  return value === "24h" || value === "14d";
}

/**
 * Resolves the UTC-aligned bucket window for a period. The last bucket is the one
 * containing `now` (current hour for 24h, current UTC day for 14d).
 */
function resolveEventTrendWindow(period: EventTrendPeriod, now = new Date()): EventTrendWindow {
  const { bucketSeconds, bucketCount } = EVENT_TREND_PERIODS[period];
  const bucketMs = bucketSeconds * 1000;
  const currentBucketStartMs = Math.floor(now.getTime() / bucketMs) * bucketMs;
  const startMs = currentBucketStartMs - (bucketCount - 1) * bucketMs;

  return {
    period,
    bucketSeconds,
    bucketCount,
    start: new Date(startMs),
    end: new Date(currentBucketStartMs + bucketMs),
  };
}

/**
 * SQL expression yielding the zero-based bucket index of `timestampColumn` within the window.
 * Buckets are aligned on the UTC epoch, so no session time zone is involved.
 */
function eventTrendBucketIndexSql(timestampColumn: AnyColumn, window: EventTrendWindow) {
  return sql<
    number | null
  >`floor(extract(epoch from (${timestampColumn} - ${window.start.toISOString()}::timestamptz)) / ${window.bucketSeconds})::int`;
}

function buildZeroFilledCounts(window: EventTrendWindow, rows: EventTrendBucketRow[]) {
  const counts = Array.from({ length: window.bucketCount }, () => 0);

  for (const row of rows) {
    if (row.bucket === null || row.bucket < 0 || row.bucket >= window.bucketCount) {
      continue;
    }

    counts[row.bucket] += Number(row.count);
  }

  return counts;
}

function sumEventTrends(bucketCount: number, trends: number[][]) {
  const totals = Array.from({ length: bucketCount }, () => 0);

  for (const trend of trends) {
    trend.forEach((value, index) => {
      if (index < bucketCount) {
        totals[index] += value;
      }
    });
  }

  return totals;
}

export {
  EVENT_TREND_PERIODS,
  buildZeroFilledCounts,
  eventTrendBucketIndexSql,
  isEventTrendPeriod,
  resolveEventTrendWindow,
  sumEventTrends,
};
export type { EventTrendBucketRow, EventTrendPeriod, EventTrendWindow };
