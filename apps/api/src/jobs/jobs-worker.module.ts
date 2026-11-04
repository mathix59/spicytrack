import { Module } from "@nestjs/common";
import { IssueCountsService } from "../ingest/issue-counts.service";
import { EventPartitionsService } from "./handlers/event-partitions";
import { RetentionCleanupHandler } from "./handlers/retention-cleanup.handler";
import { JobsRunnerService } from "./jobs-runner.service";
import { JobsModule } from "./jobs.module";

@Module({
  imports: [JobsModule],
  providers: [
    JobsRunnerService,
    RetentionCleanupHandler,
    EventPartitionsService,
    IssueCountsService,
  ],
  exports: [JobsRunnerService, IssueCountsService],
})
export class JobsWorkerModule {}
