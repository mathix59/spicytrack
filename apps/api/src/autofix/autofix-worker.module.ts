import { Injectable, Module, type OnModuleInit } from "@nestjs/common";
import { JobsRunnerService } from "../jobs/jobs-runner.service";
import { JobsWorkerModule } from "../jobs/jobs-worker.module";
import { AutofixJobHandler } from "./autofix-job.handler";
import { AutofixModule } from "./autofix.module";

@Injectable()
export class AutofixWorkerRegistration implements OnModuleInit {
  constructor(
    private readonly runner: JobsRunnerService,
    private readonly handler: AutofixJobHandler,
  ) {}

  onModuleInit(): void {
    this.runner.registerSlowHandler("autofix", (job) => this.handler.run(job));
  }
}

@Module({
  imports: [AutofixModule, JobsWorkerModule],
  providers: [AutofixWorkerRegistration],
})
export class AutofixWorkerModule {}
