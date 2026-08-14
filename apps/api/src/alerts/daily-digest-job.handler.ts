import { Injectable, type OnModuleInit } from "@nestjs/common";
import { JobsRunnerService } from "../jobs/jobs-runner.service";
import { JobsService } from "../jobs/jobs.service";
import { DailyDigestService } from "./daily-digest.service";

const DAILY_DIGEST_JOB_TYPE = "daily_error_digest";

function dailyDigestDedupeKey(runAt: Date) {
  return `${DAILY_DIGEST_JOB_TYPE}:${runAt.toISOString().slice(0, 10)}`;
}

export function nextDailyDigestAt(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(8, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

@Injectable()
export class DailyDigestJobHandler implements OnModuleInit {
  constructor(
    private readonly runner: JobsRunnerService,
    private readonly jobs: JobsService,
    private readonly digests: DailyDigestService,
  ) {}

  async onModuleInit() {
    this.runner.registerHandler(DAILY_DIGEST_JOB_TYPE, async () => {
      await this.digests.run();
      const nextRunAt = nextDailyDigestAt();
      await this.jobs.enqueue(DAILY_DIGEST_JOB_TYPE, {}, nextRunAt, {
        dedupeKey: dailyDigestDedupeKey(nextRunAt),
      });
    });
    if (!(await this.jobs.hasPending(DAILY_DIGEST_JOB_TYPE))) {
      const runAt = new Date();
      await this.jobs.enqueue(DAILY_DIGEST_JOB_TYPE, {}, runAt, {
        dedupeKey: dailyDigestDedupeKey(runAt),
      });
    }
  }
}
