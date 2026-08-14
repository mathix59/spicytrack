import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AlertsModule } from "./alerts/alerts.module";
import { AiUsageWorkerModule } from "./ai-usage/ai-usage-worker.module";
import { AutofixWorkerModule } from "./autofix/autofix-worker.module";
import { DatabaseModule } from "./database/database.module";
import { PostIngestAdminModule } from "./ingest/post-ingest-admin.module";
import { DailyDigestJobHandler } from "./alerts/daily-digest-job.handler";
import { JobsModule } from "./jobs/jobs.module";
import { JobsWorkerModule } from "./jobs/jobs-worker.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    DatabaseModule,
    AlertsModule,
    AiUsageWorkerModule,
    AutofixWorkerModule,
    JobsModule,
    JobsWorkerModule,
    PostIngestAdminModule,
  ],
  providers: [DailyDigestJobHandler],
})
export class AppWorkerAdminModule {}
