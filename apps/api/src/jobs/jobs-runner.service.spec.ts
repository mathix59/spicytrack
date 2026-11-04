import { Logger } from "@nestjs/common";
import type { IssueCountsService } from "../ingest/issue-counts.service";
import { RetentionCleanupHandler } from "./handlers/retention-cleanup.handler";
import { JobTimeoutError, JobsRunnerService } from "./jobs-runner.service";
import type { Job, JobsService } from "./jobs.service";

function job(id: string, type = "work", attempts = 1): Job {
  return { id, type, attempts } as Job;
}

function createJobsService(queue: Job[] = []) {
  return {
    enqueue: jest.fn().mockResolvedValue(undefined),
    claimNext: jest.fn().mockImplementation(async () => queue.shift() ?? null),
    markSucceeded: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
    reschedule: jest.fn().mockResolvedValue(undefined),
    recoverStalled: jest.fn().mockResolvedValue(0),
  };
}

function createRunner(jobsService: ReturnType<typeof createJobsService>) {
  return new JobsRunnerService(
    jobsService as unknown as JobsService,
    {
      run: jest.fn().mockResolvedValue(undefined),
    } as unknown as RetentionCleanupHandler,
    { flushAll: jest.fn().mockResolvedValue(0) } as unknown as IssueCountsService,
  );
}

describe("JobsRunnerService", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    delete process.env.JOBS_CONCURRENCY;
    delete process.env.JOBS_TIMEOUT_MS;
  });

  it("contains database errors raised by a polling lane", async () => {
    jest.useFakeTimers();
    const error = new Error("database unavailable");
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const jobsService = createJobsService();
    jobsService.claimNext.mockRejectedValue(error);
    const runner = createRunner(jobsService);
    runner.registerSlowHandler("autofix", jest.fn());

    await runner.onModuleInit();
    await jest.advanceTimersByTimeAsync(5_000);

    expect(logger).toHaveBeenCalledWith(
      "Job slow polling failed: database unavailable",
      error.stack,
    );
    runner.onModuleDestroy();
  });

  it("enqueues a single run of each recurring job through its dedupe key", async () => {
    jest.useFakeTimers();
    const jobsService = createJobsService();
    const runner = createRunner(jobsService);

    await runner.onModuleInit();

    for (const type of ["retention_cleanup", "issue_counts_sweep"]) {
      expect(jobsService.enqueue).toHaveBeenCalledWith(type, {}, expect.any(Date), {
        dedupeKey: type,
      });
    }
    runner.onModuleDestroy();
  });

  it("queues the next run of a recurring job once it is done", async () => {
    jest.useFakeTimers({ now: 0 });
    const jobsService = createJobsService([job("sweep", "issue_counts_sweep")]);
    const runner = createRunner(jobsService);

    await runner.tick();

    expect(jobsService.markSucceeded).toHaveBeenCalledWith("sweep");
    expect(jobsService.enqueue).toHaveBeenCalledWith("issue_counts_sweep", {}, new Date(60_000), {
      dedupeKey: "issue_counts_sweep",
    });
  });

  it("drains every due job in one tick, several at a time", async () => {
    process.env.JOBS_CONCURRENCY = "3";
    const jobsService = createJobsService(Array.from({ length: 10 }, (_, i) => job(`j${i}`)));
    const runner = createRunner(jobsService);
    let inFlight = 0;
    let maxInFlight = 0;
    runner.registerHandler("work", async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
    });

    await runner.tick();

    expect(jobsService.markSucceeded).toHaveBeenCalledTimes(10);
    expect(maxInFlight).toBe(3);
  });

  it("fails a job that runs past its timeout and aborts its signal", async () => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    process.env.JOBS_TIMEOUT_MS = "1000";
    const jobsService = createJobsService([job("slow")]);
    const runner = createRunner(jobsService);
    let signal: AbortSignal | undefined;
    runner.registerHandler("work", (_job, jobSignal) => {
      signal = jobSignal;
      return new Promise(() => undefined);
    });

    const tick = runner.tick();
    await jest.advanceTimersByTimeAsync(1_000);
    await tick;

    expect(signal?.aborted).toBe(true);
    expect(signal?.reason).toBeInstanceOf(JobTimeoutError);
    expect(jobsService.markSucceeded).not.toHaveBeenCalled();
    expect(jobsService.reschedule).toHaveBeenCalledWith(
      "slow",
      "Job timed out after 1000ms",
      expect.any(Date),
    );
  });

  it("recovers stalled jobs at most once a minute", async () => {
    const jobsService = createJobsService();
    const runner = createRunner(jobsService);

    await runner.tick();
    await runner.tick();

    expect(jobsService.recoverStalled).toHaveBeenCalledTimes(1);
    expect(jobsService.recoverStalled).toHaveBeenCalledWith(
      ["retention_cleanup", "issue_counts_sweep"],
      expect.any(Date),
      5,
    );
  });

  it("reports a stuck worker when polling stops or a drain makes no progress", async () => {
    jest.useFakeTimers({ now: 0 });
    process.env.JOBS_TIMEOUT_MS = "120000";
    const jobsService = createJobsService();
    const runner = createRunner(jobsService);

    await runner.tick();
    expect(runner.stuckReason(30_000)).toBeNull();
    expect(runner.stuckReason(61_000)).toBe("job polling stopped");

    // A drain that started and never finishes a job: polling continues, progress does not.
    jobsService.claimNext.mockImplementation(() => new Promise(() => undefined));
    void runner.tick();
    for (let time = 2_000; time <= 190_000; time += 2_000) {
      jest.setSystemTime(time);
      await runner.tick();
    }
    expect(runner.stuckReason(190_000)).toBe("job queue drain is stuck");
  });
});
