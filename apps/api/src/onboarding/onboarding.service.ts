import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE, primaryDatabase, type DatabaseClient } from "../database/database.provider";
import { projects } from "../database/schema";
import { IngestService } from "../ingest/ingest.service";
import { buildTestEvent } from "../ingest/test-event";

export const MAX_FIRST_EVENT_WAIT_SECONDS = 25;
const FIRST_EVENT_CHECK_INTERVAL_MS = 1_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class OnboardingService {
  private readonly db: DatabaseClient;

  constructor(
    @Inject(DATABASE) database: DatabaseClient,
    private readonly ingestService: IngestService,
  ) {
    // The primary: a replica lagging behind would delay the "first event" moment.
    this.db = primaryDatabase(database);
  }

  private async readEventTimes(projectId: string) {
    const [project] = await this.db
      .select({ firstEventAt: projects.firstEventAt, lastEventAt: projects.lastEventAt })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return {
      firstEventAt: project?.firstEventAt ?? null,
      lastEventAt: project?.lastEventAt ?? null,
    };
  }

  /**
   * Long-poll: answers as soon as the project has its first event, or after `waitSeconds`.
   * One primary-key read per second is far cheaper than clients polling the issue list.
   */
  async waitForFirstEvent(projectId: string, waitSeconds: number, isClosed: () => boolean) {
    const deadline = Date.now() + waitSeconds * 1000;
    let times = await this.readEventTimes(projectId);
    while (!times.firstEventAt && Date.now() < deadline && !isClosed()) {
      await sleep(Math.min(FIRST_EVENT_CHECK_INTERVAL_MS, Math.max(0, deadline - Date.now())));
      times = await this.readEventTimes(projectId);
    }
    return times;
  }

  async sendTestEvent(project: { id: string; platform: string }, sentBy: string) {
    const result = await this.ingestService.ingestTestEvent(
      project.id,
      buildTestEvent({ platform: project.platform, sentBy }),
    );
    return {
      stored: !("dropped" in result && result.dropped),
      issueId: "issueId" in result ? (result.issueId ?? null) : null,
      eventId: "eventId" in result ? (result.eventId ?? null) : null,
      reason: "reason" in result ? (result.reason ?? null) : null,
    };
  }
}
