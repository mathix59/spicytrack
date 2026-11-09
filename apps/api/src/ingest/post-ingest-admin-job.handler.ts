import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { AlertsService } from "../alerts/alerts.service";
import { SourcemapResolverService } from "../artifacts/sourcemap-resolver.service";
import { AutofixService } from "../autofix/autofix.service";
import { Job } from "../jobs/jobs.service";
import { JobsRunnerService } from "../jobs/jobs-runner.service";
import { IssueCountsService } from "./issue-counts.service";
import { POST_INGEST_ADMIN_JOB_TYPE, type PostIngestAdminJobPayload } from "./post-ingest-job";

@Injectable()
export class PostIngestAdminJobHandler implements OnModuleInit {
  private readonly logger = new Logger(PostIngestAdminJobHandler.name);

  constructor(
    private readonly jobsRunnerService: JobsRunnerService,
    private readonly alertsService: AlertsService,
    private readonly autofixService: AutofixService,
    private readonly issueCounts: IssueCountsService,
    private readonly sourcemapResolver: SourcemapResolverService,
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

    // Picks up counts a skipped or failed flush at ingest left pending, ahead of the sweep.
    await this.issueCounts.flush(payload.issueId);

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

    // Last, so alerts never wait on it: source-maps the event now, and the issue opens instantly
    // even for a new issue or a new release. The view resolves the frames itself if this fails.
    try {
      await this.sourcemapResolver.prepareEventFrames(payload.projectId, payload.eventId);
    } catch (error) {
      this.logger.warn(
        `Could not prepare stack frames of event ${payload.eventId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
