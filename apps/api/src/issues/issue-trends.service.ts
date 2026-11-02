import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import {
  buildZeroFilledCounts,
  eventTrendBucketIndexSql,
  resolveEventTrendWindow,
} from "../common/event-trends.utils";
import type { EventTrendBucketRow, EventTrendPeriod } from "../common/event-trends.utils";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { events, issues } from "../database/schema";

@Injectable()
export class IssueTrendsService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  /**
   * Returns zero-filled per-bucket event counts for the requested issues, in request order.
   * Issue ids that do not belong to the project are silently ignored. Ownership and counts
   * come from a single grouped query (issues LEFT JOIN events).
   */
  async getTrends(input: {
    projectId: string;
    issueIds: string[];
    period: EventTrendPeriod;
    now?: Date;
  }) {
    const window = resolveEventTrendWindow(input.period, input.now);

    const rows = await this.db
      .select({
        issueId: issues.id,
        bucket: eventTrendBucketIndexSql(events.timestamp, window),
        count: sql<number>`count(${events.id})::int`,
      })
      .from(issues)
      .leftJoin(
        events,
        and(
          eq(events.issueId, issues.id),
          eq(events.projectId, issues.projectId),
          gte(events.timestamp, window.start),
          lt(events.timestamp, window.end),
        ),
      )
      .where(and(eq(issues.projectId, input.projectId), inArray(issues.id, input.issueIds)))
      .groupBy(issues.id, sql`2`);

    const rowsByIssueId = new Map<string, EventTrendBucketRow[]>();
    for (const row of rows) {
      const issueRows = rowsByIssueId.get(row.issueId) ?? [];
      issueRows.push({ bucket: row.bucket, count: row.count });
      rowsByIssueId.set(row.issueId, issueRows);
    }

    return {
      period: window.period,
      bucketSeconds: window.bucketSeconds,
      start: window.start.toISOString(),
      items: input.issueIds.flatMap((issueId) => {
        const issueRows = rowsByIssueId.get(issueId);
        return issueRows ? [{ issueId, counts: buildZeroFilledCounts(window, issueRows) }] : [];
      }),
    };
  }
}
