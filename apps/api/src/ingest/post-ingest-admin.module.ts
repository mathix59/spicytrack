import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module";
import { AutofixModule } from "../autofix/autofix.module";
import { JobsWorkerModule } from "../jobs/jobs-worker.module";
import { PostIngestAdminJobHandler } from "./post-ingest-admin-job.handler";

@Module({
  imports: [AlertsModule, AutofixModule, JobsWorkerModule],
  providers: [PostIngestAdminJobHandler],
})
export class PostIngestAdminModule {}
