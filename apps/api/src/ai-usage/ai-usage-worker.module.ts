import { Injectable, Module, OnModuleInit } from "@nestjs/common";

import { JobsRunnerService } from "../jobs/jobs-runner.service";
import { JobsWorkerModule } from "../jobs/jobs-worker.module";
import { AiPricingSyncService } from "./ai-pricing-sync.service";
import { AiUsageModule } from "./ai-usage.module";

@Injectable()
class AiPricingSyncJobHandler implements OnModuleInit {
  constructor(
    private readonly jobsRunner: JobsRunnerService,
    private readonly pricingSync: AiPricingSyncService,
  ) {}

  async onModuleInit() {
    this.jobsRunner.registerHandler("ai_pricing_sync", async () => {
      await this.pricingSync.sync();
    });
    await this.pricingSync.ensureScheduled();
  }
}

@Module({
  imports: [AiUsageModule, JobsWorkerModule],
  providers: [AiPricingSyncJobHandler],
})
export class AiUsageWorkerModule {}
