import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, lt, notExists } from "drizzle-orm";
import { DATABASE } from "../../database/database.provider";
import type { DatabaseClient } from "../../database/database.provider";
import {
  alertIssueCooldowns,
  events,
  ingestRateCounters,
  issues,
  projects,
} from "../../database/schema";

const BATCH_SIZE = 500;
/** Longest cooldown a rule accepts; an older cooldown row behaves exactly like a missing one. */
const MAX_ALERT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Retention cuts on `ingestedAt` (server receipt time), not the client-supplied
// `timestamp`, since the latter isn't trustworthy for a deletion policy.
@Injectable()
export class RetentionCleanupHandler {
  private readonly logger = new Logger(RetentionCleanupHandler.name);

  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async run(): Promise<void> {
    await this.db
      .delete(ingestRateCounters)
      .where(lt(ingestRateCounters.updatedAt, new Date(Date.now() - 48 * 60 * 60 * 1000)));
    await this.db
      .delete(alertIssueCooldowns)
      .where(lt(alertIssueCooldowns.lastTriggeredAt, new Date(Date.now() - MAX_ALERT_COOLDOWN_MS)));

    const projectRows = await this.db
      .select({ id: projects.id, retentionDays: projects.retentionDays })
      .from(projects);

    for (const project of projectRows) {
      const cutoff = new Date(Date.now() - project.retentionDays * 24 * 60 * 60 * 1000);

      const deletedEvents = await this.deleteOldEvents(project.id, cutoff);
      const deletedIssues = await this.deleteOrphanedIssues(project.id, cutoff);

      if (deletedEvents > 0 || deletedIssues > 0) {
        this.logger.log(
          `Retention cleanup for project ${project.id}: removed ${deletedEvents} events, ${deletedIssues} issues`,
        );
      }
    }
  }

  private async deleteOldEvents(projectId: string, cutoff: Date): Promise<number> {
    let total = 0;

    for (;;) {
      const staleIds = this.db
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.projectId, projectId), lt(events.ingestedAt, cutoff)))
        .limit(BATCH_SIZE);

      const deleted = await this.db
        .delete(events)
        .where(inArray(events.id, staleIds))
        .returning({ id: events.id });

      total += deleted.length;

      if (deleted.length < BATCH_SIZE) {
        break;
      }
    }

    return total;
  }

  private async deleteOrphanedIssues(projectId: string, cutoff: Date): Promise<number> {
    const deleted = await this.db
      .delete(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          lt(issues.lastSeenAt, cutoff),
          notExists(
            this.db.select({ id: events.id }).from(events).where(eq(events.issueId, issues.id)),
          ),
        ),
      )
      .returning({ id: issues.id });

    return deleted.length;
  }
}
