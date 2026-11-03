import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnvironment } from "./common/environment";
import { AlertsModule } from "./alerts/alerts.module";
import { AiUsageWorkerModule } from "./ai-usage/ai-usage-worker.module";
import { AutofixWorkerModule } from "./autofix/autofix-worker.module";
import { DatabaseModule } from "./database/database.module";
import { PostIngestAdminModule } from "./ingest/post-ingest-admin.module";
import { ReleaseCommitsWorkerModule } from "./release-commits/release-commits-worker.module";
import { AlertDeliveryJobHandler } from "./alerts/alert-delivery-job.handler";
import { DailyDigestJobHandler } from "./alerts/daily-digest-job.handler";
import { JobsModule } from "./jobs/jobs.module";
import { JobsWorkerModule } from "./jobs/jobs-worker.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment("worker-admin"),
      envFilePath: [".env", "../../.env"],
    }),
    DatabaseModule,
    AlertsModule,
    AiUsageWorkerModule,
    AutofixWorkerModule,
    JobsModule,
    JobsWorkerModule,
    PostIngestAdminModule,
    ReleaseCommitsWorkerModule,
  ],
  providers: [AlertDeliveryJobHandler, DailyDigestJobHandler],
})
export class AppWorkerAdminModule {}
