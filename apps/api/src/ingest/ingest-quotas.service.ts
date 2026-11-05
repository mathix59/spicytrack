import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { ingestRateCounters } from "../database/schema";
import { ApproximateQuotas, type QuotaDelta, type QuotaReservation } from "./approximate-quotas";
import { ingestLimits } from "./ingest-limits";
import { recordIngestOutcome } from "./ingest-metrics";
import type { IngestProjectAccess } from "./ingest.types";

/** How often counted units are written; also bounds how stale another process's view is. */
const FLUSH_INTERVAL_MS = 1_000;

const SENTRY_QUOTA_SCOPES: Record<string, string> = {
  project_key_minute: "key",
  project_hour: "project",
  organization_hour: "organization",
};

export class IngestQuotaExceededException extends HttpException {
  constructor(
    scope: string,
    /** Seconds until the quota window resets. */
    readonly retryAfterSeconds: number,
  ) {
    super(`Ingestion quota exceeded: ${scope}`, HttpStatus.TOO_MANY_REQUESTS);
    this.sentryScope = SENTRY_QUOTA_SCOPES[scope] ?? "project";
  }

  readonly sentryScope: string;

  /**
   * Headers Sentry SDKs read to pause sending until the window resets: Retry-After, and
   * X-Sentry-Rate-Limits as `<seconds>:<categories, empty = all>:<scope>:<reason>`.
   */
  get headers(): Record<string, string> {
    return {
      "Retry-After": String(this.retryAfterSeconds),
      "X-Sentry-Rate-Limits": `${this.retryAfterSeconds}::${this.sentryScope}:quota_exceeded`,
    };
  }
}

/**
 * Ingestion quotas. The hourly project, organization and session budgets protect the instance
 * from a runaway SDK, so they are counted in memory and written about once a second (see
 * ApproximateQuotas). The per-key limit can be as low as a few events a minute, so it stays
 * exact: one atomic update per event.
 */
@Injectable()
export class IngestQuotasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestQuotasService.name);
  private readonly quotas = new ApproximateQuotas((deltas) => this.writeCounters(deltas));
  private timer: NodeJS.Timeout | null = null;

  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  /** Writes counted units now; failed writes are kept for the next flush. */
  async flush() {
    try {
      await this.quotas.flush();
    } catch (error) {
      this.logger.warn(
        `Could not write ingest quota counters: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Counts one event, or throws IngestQuotaExceededException without counting it anywhere. */
  async consumeEvent(project: IngestProjectAccess): Promise<void> {
    try {
      await this.reserveEvent(project);
    } catch (error) {
      if (error instanceof IngestQuotaExceededException) {
        recordIngestOutcome("rejected", "quota_exceeded");
      }
      throw error;
    }
  }

  private async reserveEvent(project: IngestProjectAccess) {
    const limits = ingestLimits();
    const hourly = [
      { scope: "project_hour", scopeId: project.id, limit: limits.projectEventsPerHour },
      {
        scope: "organization_hour",
        scopeId: project.organizationId,
        limit: limits.organizationEventsPerHour,
      },
    ].filter((quota) => quota.limit > 0);

    const reserved: Extract<QuotaReservation, { allowed: true }>[] = [];
    const releaseAll = () => reserved.forEach((reservation) => reservation.release());
    for (const quota of hourly) {
      const reservation = await this.quotas.reserve(
        { scope: quota.scope, scopeId: quota.scopeId, windowMs: 3_600_000 },
        quota.limit,
      );
      if (!reservation.allowed) {
        releaseAll();
        throw new IngestQuotaExceededException(quota.scope, reservation.retryAfterSeconds);
      }
      reserved.push(reservation);
    }

    try {
      await this.consumeKeyMinute(project);
    } catch (error) {
      releaseAll();
      throw error;
    }
  }

  /** Counts session items against the project's hourly budget; false when over it. */
  async consumeSessions(project: IngestProjectAccess, units: number): Promise<boolean> {
    const limit = ingestLimits().projectSessionsPerHour;
    if (limit === 0) return true;
    const reservation = await this.quotas.reserve(
      { scope: "project_sessions_hour", scopeId: project.id, windowMs: 3_600_000 },
      limit,
      units,
    );
    return reservation.allowed;
  }

  private async consumeKeyMinute(project: IngestProjectAccess) {
    const limit = project.keyRateLimitPerMinute ?? 0;
    if (limit <= 0) return;
    const now = Date.now();
    const windowStartedAt = new Date(Math.floor(now / 60_000) * 60_000);
    // Refused events are not counted: the update only applies while the key is under its limit.
    const result = await this.db.execute<{ count: number }>(sql`
      insert into ${ingestRateCounters} (scope, scope_id, window_started_at, count)
      values ('project_key_minute', ${project.projectKeyId}, ${windowStartedAt}, 1)
      on conflict (scope, scope_id, window_started_at) do update
        set count = ${ingestRateCounters}.count + 1, updated_at = now()
        where ${ingestRateCounters}.count < ${limit}
      returning count
    `);
    if (result.rows.length === 0) {
      const resetsAt = windowStartedAt.getTime() + 60_000;
      throw new IngestQuotaExceededException(
        "project_key_minute",
        Math.max(1, Math.ceil((resetsAt - now) / 1000)),
      );
    }
  }

  private async writeCounters(deltas: QuotaDelta[]) {
    return this.db.transaction(async (tx) => {
      // Losing this commit in a crash forgets at most a second of counted events.
      await tx.execute(sql`set local synchronous_commit = off`);
      return tx
        .insert(ingestRateCounters)
        .values(
          deltas.map((delta) => ({
            scope: delta.scope,
            scopeId: delta.scopeId,
            windowStartedAt: delta.windowStartedAt,
            count: delta.units,
          })),
        )
        .onConflictDoUpdate({
          target: [
            ingestRateCounters.scope,
            ingestRateCounters.scopeId,
            ingestRateCounters.windowStartedAt,
          ],
          set: {
            count: sql`${ingestRateCounters.count} + excluded.count`,
            updatedAt: new Date(),
          },
        })
        .returning({
          scope: ingestRateCounters.scope,
          scopeId: ingestRateCounters.scopeId,
          windowStartedAt: ingestRateCounters.windowStartedAt,
          count: ingestRateCounters.count,
        });
    });
  }
}
