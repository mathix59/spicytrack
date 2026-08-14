import { Injectable, type OnModuleInit } from "@nestjs/common";
import { AlertsService } from "../alerts/alerts.service";
import { AutofixService } from "../autofix/autofix.service";
import { Job } from "../jobs/jobs.service";
import { JobsRunnerService } from "../jobs/jobs-runner.service";
import { POST_INGEST_ADMIN_JOB_TYPE, type PostIngestAdminJobPayload } from "./post-ingest-job";

@Injectable()
export class PostIngestAdminJobHandler implements OnModuleInit {
  constructor(
    private readonly jobsRunnerService: JobsRunnerService,
    private readonly alertsService: AlertsService,
    private readonly autofixService: AutofixService,
  ) {}

  onModuleInit(): void {
    this.jobsRunnerService.registerHandler(POST_INGEST_ADMIN_JOB_TYPE, (job) => this.run(job));
  }

  async run(job: Job): Promise<void> {
    const payload = job.payload as Partial<PostIngestAdminJobPayload>;

    if (
      !payload.organizationId ||
      !payload.projectId ||
      !payload.issueId ||
      !payload.eventId ||
      !payload.issueTitle ||
      !payload.issueStatus ||
      typeof payload.timesSeen !== "number" ||
      typeof payload.issueWasCreated !== "boolean"
    ) {
      throw new Error("post_ingest_admin job payload is invalid");
    }

    await this.alertsService.handleEvent({
      organizationId: payload.organizationId,
      projectId: payload.projectId,
      issueId: payload.issueId,
      eventId: payload.eventId,
      issueTitle: payload.issueTitle,
      issueStatus: payload.issueStatus,
      timesSeen: payload.timesSeen,
      issueWasCreated: payload.issueWasCreated,
      issueRegressed: payload.issueRegressed ?? false,
    });

    if (payload.issueWasCreated) {
      try {
        await this.autofixService.maybeAutoTrigger(
          payload.organizationId,
          payload.projectId,
          payload.issueId,
        );
      } catch {
        // Autofix must never break the post-ingest worker.
      }
    }
  }
}
