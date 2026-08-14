import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { JobsModule } from "../jobs/jobs.module";
import { AiPricingSyncService } from "./ai-pricing-sync.service";
import { AiUsageService } from "./ai-usage.service";

@Module({
  imports: [DatabaseModule, JobsModule, AuditModule],
  providers: [AiUsageService, AiPricingSyncService],
  exports: [AiUsageService, AiPricingSyncService],
})
export class AiUsageModule {}
