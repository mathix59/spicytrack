import { Module } from "@nestjs/common";
import { EventPartitionsService } from "./handlers/event-partitions";
import { RetentionCleanupHandler } from "./handlers/retention-cleanup.handler";
import { JobsRunnerService } from "./jobs-runner.service";
import { JobsModule } from "./jobs.module";

@Module({
  imports: [JobsModule],
  providers: [JobsRunnerService, RetentionCleanupHandler, EventPartitionsService],
  exports: [JobsRunnerService],
})
export class JobsWorkerModule {}
