import { Injectable, Module, type OnModuleInit } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { ArtifactsModule } from "../artifacts/artifacts.module";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { releases } from "../database/schema";
import { JobsRunnerService } from "../jobs/jobs-runner.service";
import { JobsWorkerModule } from "../jobs/jobs-worker.module";
import { Inject } from "@nestjs/common";
import { RELEASE_COMMITS_JOB, ReleaseCommitsService } from "./release-commits.service";

@Injectable()
export class ReleaseCommitsWorkerRegistration implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly runner: JobsRunnerService,
    private readonly service: ReleaseCommitsService,
  ) {}

  onModuleInit(): void {
    this.runner.registerHandler(RELEASE_COMMITS_JOB, async (job) => {
      const releaseId = (job.payload as { releaseId?: unknown }).releaseId;
      if (typeof releaseId !== "string") throw new Error("release_commits_sync payload is invalid");
      try {
        await this.service.sync(releaseId);
      } catch (error) {
        // Without this, a release whose last retry failed would stay "pending" for ever.
        if (this.runner.isFinalAttempt(job)) {
          const message = error instanceof Error ? error.message : String(error);
          await this.db
            .update(releases)
            .set({
              commitsStatus: "failed",
              commitsError: `Could not read commits from the repository: ${message.slice(0, 300)}`,
              commitsSyncedAt: new Date(),
            })
            .where(eq(releases.id, releaseId));
        }
        throw error;
      }
    });
  }
}

@Module({
  imports: [ArtifactsModule, JobsWorkerModule],
  providers: [ReleaseCommitsWorkerRegistration],
})
export class ReleaseCommitsWorkerModule {}
