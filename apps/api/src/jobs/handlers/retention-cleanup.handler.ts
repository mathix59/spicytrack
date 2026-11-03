import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, lt, notExists, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { DATABASE } from "../../database/database.provider";
import type { DatabaseClient } from "../../database/database.provider";
import {
  alertDeliveries,
  alertIssueCooldowns,
  auditLogs,
  events,
  ingestRateCounters,
  issueActivity,
  issueComments,
  issues,
  jobs,
  projects,
} from "../../database/schema";

const BATCH_SIZE = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Longest cooldown a rule accepts; an older cooldown row behaves exactly like a missing one. */
const MAX_ALERT_COOLDOWN_MS = 7 * DAY_MS;

type RetentionSettings = {
  succeededJobsDays: number;
  failedJobsDays: number;
  alertDeliveriesDays: number;
  /** 0 keeps audit logs forever. */
  auditLogsDays: number;
};

function retentionDays(name: string, fallback: number, allowZero = false): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && (value > 0 || (allowZero && value === 0)) ? value : fallback;
}

export function retentionSettings(): RetentionSettings {
  return {
    succeededJobsDays: retentionDays("JOBS_SUCCEEDED_RETENTION_DAYS", 7),
    failedJobsDays: retentionDays("JOBS_FAILED_RETENTION_DAYS", 30),
    alertDeliveriesDays: retentionDays("ALERT_DELIVERY_RETENTION_DAYS", 30),
    auditLogsDays: retentionDays("AUDIT_LOG_RETENTION_DAYS", 365, true),
  };
}

// Retention cuts on `ingestedAt` (server receipt time), not the client-supplied
// `timestamp`, since the latter isn't trustworthy for a deletion policy.
@Injectable()
export class RetentionCleanupHandler {
  private readonly logger = new Logger(RetentionCleanupHandler.name);

  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async run(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const settings = retentionSettings();
    const ago = (days: number) => new Date(now - days * DAY_MS);

    await this.db
      .delete(ingestRateCounters)
      .where(lt(ingestRateCounters.updatedAt, new Date(now - 2 * DAY_MS)));
    await this.db
      .delete(alertIssueCooldowns)
      .where(lt(alertIssueCooldowns.lastTriggeredAt, new Date(now - MAX_ALERT_COOLDOWN_MS)));

    const projectRows = await this.db
      .select({ id: projects.id, retentionDays: projects.retentionDays })
      .from(projects);

    for (const project of projectRows) {
      signal?.throwIfAborted();
      const cutoff = ago(project.retentionDays);

      const deletedEvents = await this.deleteInBatches(
        events,
        events.id,
        and(eq(events.projectId, project.id), lt(events.ingestedAt, cutoff))!,
        signal,
      );
      const deletedIssues = await this.deleteOrphanedIssues(project.id, cutoff);

      if (deletedEvents > 0 || deletedIssues > 0) {
        this.logger.log(
          `Retention cleanup for project ${project.id}: removed ${deletedEvents} events, ${deletedIssues} issues`,
        );
      }
    }

    // Operational history that otherwise grows without bound.
    const removed = {
      jobs:
        (await this.deleteInBatches(
          jobs,
          jobs.id,
          and(eq(jobs.status, "succeeded"), lt(jobs.finishedAt, ago(settings.succeededJobsDays)))!,
          signal,
        )) +
        (await this.deleteInBatches(
          jobs,
          jobs.id,
          and(eq(jobs.status, "failed"), lt(jobs.finishedAt, ago(settings.failedJobsDays)))!,
          signal,
        )),
      alertDeliveries: await this.deleteInBatches(
        alertDeliveries,
        alertDeliveries.id,
        and(
          inArray(alertDeliveries.status, ["success", "failed"]),
          lt(alertDeliveries.createdAt, ago(settings.alertDeliveriesDays)),
        )!,
        signal,
      ),
      auditLogs:
        settings.auditLogsDays > 0
          ? await this.deleteInBatches(
              auditLogs,
              auditLogs.id,
              lt(auditLogs.createdAt, ago(settings.auditLogsDays)),
              signal,
            )
          : 0,
    };

    if (removed.jobs > 0 || removed.alertDeliveries > 0 || removed.auditLogs > 0) {
      this.logger.log(
        `Retention cleanup removed ${removed.jobs} jobs, ${removed.alertDeliveries} alert deliveries, ${removed.auditLogs} audit logs`,
      );
    }
  }

  /** Deletes in small batches so no single statement holds locks on many rows. */
  private async deleteInBatches(
    table: PgTable,
    idColumn: PgColumn,
    where: SQL,
    signal?: AbortSignal,
  ): Promise<number> {
    let total = 0;

    for (;;) {
      signal?.throwIfAborted();
      const staleIds = this.db.select({ id: idColumn }).from(table).where(where).limit(BATCH_SIZE);
      const deleted = await this.db
        .delete(table)
        .where(inArray(idColumn, staleIds))
        .returning({ id: idColumn });

      total += deleted.length;

      if (deleted.length < BATCH_SIZE) {
        return total;
      }
    }
  }

  /** Issues whose events all expired, with the comments and activity attached to them. */
  private async deleteOrphanedIssues(projectId: string, cutoff: Date): Promise<number> {
    return this.db.transaction(async (tx) => {
      const deleted = await tx
        .delete(issues)
        .where(
          and(
            eq(issues.projectId, projectId),
            lt(issues.lastSeenAt, cutoff),
            notExists(
              tx.select({ id: events.id }).from(events).where(eq(events.issueId, issues.id)),
            ),
          ),
        )
        .returning({ id: issues.id });
      const ids = deleted.map((issue) => issue.id);
      if (ids.length === 0) return 0;

      await tx.delete(issueComments).where(inArray(issueComments.issueId, ids));
      await tx.delete(issueActivity).where(inArray(issueActivity.issueId, ids));
      await tx.delete(alertIssueCooldowns).where(inArray(alertIssueCooldowns.issueId, ids));

      return ids.length;
    });
  }
}
