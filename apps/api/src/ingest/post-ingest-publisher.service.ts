import { Injectable } from "@nestjs/common";
import { JobsService } from "../jobs/jobs.service";
import { POST_INGEST_ADMIN_JOB_TYPE, type PostIngestAdminJobPayload } from "./post-ingest-job";

@Injectable()
export class PostIngestPublisherService {
  constructor(private readonly jobsService: JobsService) {}

  async enqueue(payload: PostIngestAdminJobPayload): Promise<void> {
    await this.jobsService.enqueue(POST_INGEST_ADMIN_JOB_TYPE, payload, new Date(), {
      dedupeKey: payload.eventId,
      organizationId: payload.organizationId,
      projectId: payload.projectId,
    });
  }
}
