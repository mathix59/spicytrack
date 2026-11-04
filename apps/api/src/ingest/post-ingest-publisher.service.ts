import { Injectable } from "@nestjs/common";
import { JobsService } from "../jobs/jobs.service";
import { POST_INGEST_ADMIN_JOB_TYPE, type PostIngestAdminJobPayload } from "./post-ingest-job";

/**
 * Events that neither create nor regress their issue only matter to event-threshold rules,
 * which count the issue's events themselves: one job per issue and window evaluates them all.
 */
export const POST_INGEST_THRESHOLD_WINDOW_MS = 5_000;

@Injectable()
export class PostIngestPublisherService {
  constructor(private readonly jobsService: JobsService) {}

  async enqueue(payload: PostIngestAdminJobPayload, now = Date.now()): Promise<void> {
    const options = { organizationId: payload.organizationId, projectId: payload.projectId };
    if (payload.issueWasCreated || payload.issueRegressed) {
      await this.jobsService.enqueue(POST_INGEST_ADMIN_JOB_TYPE, payload, new Date(now), {
        ...options,
        dedupeKey: payload.eventId,
      });
      return;
    }

    // Runs once the window closes, so its count includes every event of the window.
    const windowStart = now - (now % POST_INGEST_THRESHOLD_WINDOW_MS);
    const windowEnd = new Date(windowStart + POST_INGEST_THRESHOLD_WINDOW_MS);
    await this.jobsService.enqueue(POST_INGEST_ADMIN_JOB_TYPE, payload, windowEnd, {
      ...options,
      dedupeKey: `issue:${payload.issueId}:${windowStart}`,
    });
  }
}
