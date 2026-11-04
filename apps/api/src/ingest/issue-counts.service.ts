import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { issuePendingCounts } from "../database/schema";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

/** Flushes per call: a flusher that keeps finding new rows hands over to the next event. */
const MAX_FLUSH_ROUNDS = 5;

export type PendingCount = {
  issueId: string;
  eventId: string;
  seenAt: Date;
  title: string;
  culprit: string | null;
  level: string;
};

/**
 * Batches `times_seen`, `last_seen_at` and the latest event of busy issues. Each event appends a
 * pending row instead of updating its issue, so events of one issue no longer queue on that row;
 * a flush then folds every pending row of the issue in one update.
 */
@Injectable()
export class IssueCountsService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async add(tx: TransactionClient, count: PendingCount) {
    await tx.insert(issuePendingCounts).values(count);
  }

  /**
   * Folds the issue's pending rows into it. A flush already holding the issue row is skipped
   * rather than waited for: that flush looks again for rows once it is done, so it takes ours.
   * Returns the new `times_seen`, or null when this call applied nothing.
   */
  async flush(issueId: string): Promise<number | null> {
    let timesSeen: number | null = null;
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round += 1) {
      const applied = await this.flushOnce(issueId);
      if (applied === null) break;
      timesSeen = applied;
    }
    return timesSeen;
  }

  /**
   * Folds the issue's pending rows within the caller's transaction, waiting for the issue row
   * rather than skipping it, for changes that need every event of the issue counted first.
   */
  async flushIn(tx: TransactionClient, issueId: string): Promise<void> {
    await this.applyPending(tx, issueId, { wait: true });
  }

  /** Flushes every issue with pending rows, for rows a crashed or skipped flush left behind. */
  async flushAll(): Promise<number> {
    const result = await this.db.execute<{ issue_id: string }>(
      sql`select distinct issue_id from issue_pending_counts`,
    );
    for (const row of result.rows) {
      await this.flush(row.issue_id);
    }
    return result.rows.length;
  }

  private async flushOnce(issueId: string): Promise<number | null> {
    return this.db.transaction(async (tx) => {
      // A crash can lose this commit, but only with the delete of its pending rows: they stay
      // for the next flush. Not waiting for the WAL flush saves a disk sync per event.
      await tx.execute(sql`set local synchronous_commit = off`);
      return this.applyPending(tx, issueId, { wait: false });
    });
  }

  private async applyPending(
    tx: TransactionClient,
    issueId: string,
    { wait }: { wait: boolean },
  ): Promise<number | null> {
    // `no key update` leaves the key-share locks of concurrent pending inserts unblocked.
    const result = await tx.execute<{ times_seen: number }>(sql`
      with target as (
        select id from issues where id = ${issueId} for no key update ${wait ? sql`` : sql`skip locked`}
      ),
      pending as (
        delete from issue_pending_counts using target
        where issue_pending_counts.issue_id = target.id
        returning issue_pending_counts.*
      ),
      totals as (select count(*)::int as seen, max(seen_at) as last_seen_at from pending),
      latest as (select * from pending order by seen_at desc, id desc limit 1)
      update issues set
        times_seen = issues.times_seen + totals.seen,
        last_seen_at = greatest(issues.last_seen_at, totals.last_seen_at),
        last_event_id = case when latest.seen_at >= issues.last_seen_at
          then latest.event_id else issues.last_event_id end,
        title = case when latest.seen_at >= issues.last_seen_at
          then latest.title else issues.title end,
        culprit = case when latest.seen_at >= issues.last_seen_at
          then latest.culprit else issues.culprit end,
        level = case when latest.seen_at >= issues.last_seen_at
          then latest.level else issues.level end,
        updated_at = now()
      from target, totals, latest
      where issues.id = target.id
      returning issues.times_seen
    `);
    return result.rows[0]?.times_seen ?? null;
  }
}
