import { Inject, Injectable, Logger } from "@nestjs/common";
import { max, sql } from "drizzle-orm";
import { DATABASE } from "../../database/database.provider";
import type { DatabaseClient } from "../../database/database.provider";
import { projects } from "../../database/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** Weeks created ahead, so ingest never depends on this job having run recently. */
const WEEKS_AHEAD = 4;
const DEFAULT_RETENTION_DAYS = 30;

export type EventPartition = { name: string; from: Date | null; to: Date | null };

/** Monday 00:00 UTC of the date's week, the same boundary as Postgres `date_trunc('week')`. */
export function weekStart(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS);
}

export function partitionName(start: Date) {
  return `events_p${start.toISOString().slice(0, 10).replaceAll("-", "")}`;
}

function boundDate(value: string | undefined) {
  if (!value || value === "MINVALUE" || value === "MAXVALUE") return null;
  // Postgres prints `2026-11-09 00:00:00+00`; Date wants `2026-11-09T00:00:00+00:00`.
  const iso = value
    .replace(/^'|'$/g, "")
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Reads `FOR VALUES FROM (...) TO (...)`; null for the default partition. */
export function parsePartitionBound(name: string, bound: string): EventPartition | null {
  const match = /FROM \((.+)\) TO \((.+)\)/.exec(bound);
  if (!match) return null;
  return { name, from: boundDate(match[1]), to: boundDate(match[2]) };
}

/** Week starts from the current week to WEEKS_AHEAD later that no partition covers yet. */
export function missingWeeks(partitions: EventPartition[], now: Date) {
  const first = weekStart(now).getTime();
  const weeks: Date[] = [];
  for (let time = first; time <= first + WEEKS_AHEAD * WEEK_MS; time += WEEK_MS) {
    const covered = partitions.some(
      (partition) =>
        (partition.from === null || partition.from.getTime() <= time) &&
        (partition.to === null || partition.to.getTime() > time),
    );
    if (!covered) weeks.push(new Date(time));
  }
  return weeks;
}

/** Partitions whose every row is older than the cutoff. */
export function expiredPartitions(partitions: EventPartition[], cutoff: Date) {
  return partitions.filter(
    (partition) => partition.to !== null && partition.to.getTime() <= cutoff.getTime(),
  );
}

/**
 * Keeps the weekly partitions of `events`: creates the coming weeks and drops the weeks older
 * than the longest project retention. Shorter retentions still delete their rows one by one.
 */
@Injectable()
export class EventPartitionsService {
  private readonly logger = new Logger(EventPartitionsService.name);

  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async maintain(now = new Date()) {
    const partitions = await this.partitions();
    for (const start of missingWeeks(partitions, now)) {
      await this.createWeek(start);
    }

    const [row] = await this.db.select({ days: max(projects.retentionDays) }).from(projects);
    const cutoff = new Date(now.getTime() - (row?.days ?? DEFAULT_RETENTION_DAYS) * DAY_MS);
    const dropped: string[] = [];
    for (const partition of expiredPartitions(partitions, cutoff)) {
      await this.db.transaction(async (tx) => {
        // Dropping a partition locks the whole table: give up rather than queue ingest behind it.
        await tx.execute(sql`set local lock_timeout = '5s'`);
        await tx.execute(sql`drop table ${sql.identifier(partition.name)}`);
      });
      dropped.push(partition.name);
    }
    if (dropped.length > 0) {
      this.logger.log(`Dropped expired event partitions: ${dropped.join(", ")}`);
    }
    return dropped;
  }

  async partitions(): Promise<EventPartition[]> {
    const result = await this.db.execute<{ name: string; bound: string }>(sql`
      select child.relname as name, pg_get_expr(child.relpartbound, child.oid) as bound
      from pg_inherits
      join pg_class child on child.oid = pg_inherits.inhrelid
      where pg_inherits.inhparent = 'events'::regclass
    `);
    return result.rows.flatMap((row) => parsePartitionBound(row.name, row.bound) ?? []);
  }

  /** Creates one week, moving in rows the default partition caught while it was missing. */
  private async createWeek(start: Date) {
    const name = sql.identifier(partitionName(start));
    const from = start.toISOString();
    const to = new Date(start.getTime() + WEEK_MS).toISOString();
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`create table ${name} (like events including defaults)`);
      await tx.execute(sql`
        with moved as (
          delete from events_default where ingested_at >= ${from} and ingested_at < ${to}
          returning *
        )
        insert into ${name} select * from moved
      `);
      await tx.execute(
        sql`alter table events attach partition ${name} for values from (${sql.raw(`'${from}'`)}) to (${sql.raw(`'${to}'`)})`,
      );
    });
  }
}
