import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { JobsModule } from "../jobs/jobs.module";
import { AiBudgetService } from "./ai-budget.service";
import { AiPricingSyncService } from "./ai-pricing-sync.service";
import { AiUsageService } from "./ai-usage.service";

@Module({
  imports: [DatabaseModule, JobsModule, AuditModule],
  providers: [AiUsageService, AiPricingSyncService, AiBudgetService],
  exports: [AiUsageService, AiPricingSyncService, AiBudgetService],
})
export class AiUsageModule {}
