import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RetentionCleanupHandler } from "./handlers/retention-cleanup.handler";
import { JobsService } from "./jobs.service";
import type { Job } from "./jobs.service";

export type JobHandler = (job: Job, signal: AbortSignal) => Promise<void>;

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const SLOW_POLL_INTERVAL_MS = 5_000;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_JOB_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SLOW_JOB_TIMEOUT_MS = 45 * 60 * 1000;
const STALLED_SWEEP_INTERVAL_MS = 60 * 1000;
// A job still "running" this long after its timeout belongs to a worker that died.
const STALLED_GRACE_MS = 60 * 1000;
const RETENTION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const RETENTION_CLEANUP_DEDUPE_KEY = "retention_cleanup";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

export class JobTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Job timed out after ${timeoutMs}ms`);
    this.name = "JobTimeoutError";
  }
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class JobsRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsRunnerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private slowIntervalHandle: NodeJS.Timeout | null = null;
  private draining = false;
  private slowJobActive = false;
  private lastStalledSweep = 0;
  private readonly handlers: Record<string, JobHandler>;
  // Long-running jobs (minutes) get their own lane so they never block the
  // regular lane; at most one slow job runs per worker instance.
  private readonly slowHandlers: Record<string, JobHandler> = {};

  constructor(
    private readonly jobsService: JobsService,
    private readonly retentionCleanupHandler: RetentionCleanupHandler,
  ) {
    this.handlers = {
      retention_cleanup: () => this.retentionCleanupHandler.run(),
    };
  }

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers[type] = handler;
  }

  registerSlowHandler(type: string, handler: JobHandler): void {
    this.slowHandlers[type] = handler;
  }

  async onModuleInit(): Promise<void> {
    // The dedupe key keeps a single pending cleanup however many workers start.
    await this.jobsService.enqueue("retention_cleanup", {}, new Date(), {
      dedupeKey: RETENTION_CLEANUP_DEDUPE_KEY,
    });

    this.intervalHandle = setInterval(
      () => {
        void this.tick().catch((error: unknown) => this.logPollingFailure("regular", error));
      },
      positiveIntegerFromEnv("JOBS_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
    );

    this.slowIntervalHandle = setInterval(() => {
      void this.slowTick().catch((error: unknown) => this.logPollingFailure("slow", error));
    }, SLOW_POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    if (this.slowIntervalHandle) {
      clearInterval(this.slowIntervalHandle);
    }
  }

  /** Drains every due job with up to JOBS_CONCURRENCY jobs in flight. */
  async tick(): Promise<void> {
    if (this.draining) {
      return;
    }

    this.draining = true;

    try {
      await this.recoverStalledJobs();
      const concurrency = positiveIntegerFromEnv("JOBS_CONCURRENCY", DEFAULT_CONCURRENCY);
      await Promise.all(Array.from({ length: concurrency }, () => this.drainLane()));
    } finally {
      this.draining = false;
    }
  }

  private async drainLane(): Promise<void> {
    for (;;) {
      const job = await this.jobsService.claimNext(Object.keys(this.handlers));

      if (!job) {
        return;
      }

      await this.execute(job, this.handlers[job.type], this.jobTimeout());

      if (job.type === "retention_cleanup") {
        await this.jobsService.enqueue(
          "retention_cleanup",
          {},
          new Date(Date.now() + RETENTION_CLEANUP_INTERVAL_MS),
          { dedupeKey: RETENTION_CLEANUP_DEDUPE_KEY },
        );
      }
    }
  }

  async slowTick(): Promise<void> {
    const types = Object.keys(this.slowHandlers);

    if (this.slowJobActive || types.length === 0) {
      return;
    }

    this.slowJobActive = true;

    try {
      const job = await this.jobsService.claimNext(types);

      if (job) {
        await this.execute(job, this.slowHandlers[job.type], this.slowJobTimeout());
      }
    } finally {
      this.slowJobActive = false;
    }
  }

  private async execute(job: Job, handler: JobHandler, timeoutMs: number): Promise<void> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new JobTimeoutError(timeoutMs);
        controller.abort(error);
        reject(error);
      }, timeoutMs);
    });

    try {
      await Promise.race([handler(job, controller.signal), timeout]);
      await this.jobsService.markSucceeded(job.id);
    } catch (error) {
      await this.handleFailure(job, error);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Puts back jobs left "running" by a worker that crashed or was killed mid-job. */
  private async recoverStalledJobs(): Promise<void> {
    const now = Date.now();

    if (now - this.lastStalledSweep < STALLED_SWEEP_INTERVAL_MS) {
      return;
    }

    this.lastStalledSweep = now;
    const lanes = [
      { types: Object.keys(this.handlers), timeoutMs: this.jobTimeout() },
      { types: Object.keys(this.slowHandlers), timeoutMs: this.slowJobTimeout() },
    ];

    for (const lane of lanes) {
      if (lane.types.length === 0) {
        continue;
      }

      const recovered = await this.jobsService.recoverStalled(
        lane.types,
        new Date(now - lane.timeoutMs - STALLED_GRACE_MS),
        positiveIntegerFromEnv("JOBS_MAX_ATTEMPTS", DEFAULT_MAX_ATTEMPTS),
      );

      if (recovered > 0) {
        this.logger.warn(`Recovered ${recovered} stalled job(s)`);
      }
    }
  }

  private async handleFailure(job: Job, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const maxAttempts = this.resolveMaxAttempts(job.type);

    if (job.attempts < maxAttempts) {
      const retryAt = new Date(Date.now() + this.computeRetryDelay(job.attempts));
      this.logger.warn(
        `Job ${job.type} (${job.id}) failed on attempt ${job.attempts}/${maxAttempts}; retrying at ${retryAt.toISOString()}: ${message}`,
      );
      await this.jobsService.reschedule(job.id, message, retryAt);
      return;
    }

    this.logger.error(`Job ${job.type} (${job.id}) failed permanently: ${message}`);
    await this.jobsService.markFailed(job.id, message);
  }

  private logPollingFailure(lane: "regular" | "slow", error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Job ${lane} polling failed: ${message}`, stack);
  }

  private jobTimeout(): number {
    return positiveIntegerFromEnv("JOBS_TIMEOUT_MS", DEFAULT_JOB_TIMEOUT_MS);
  }

  private slowJobTimeout(): number {
    return positiveIntegerFromEnv("JOBS_SLOW_TIMEOUT_MS", DEFAULT_SLOW_JOB_TIMEOUT_MS);
  }

  private resolveMaxAttempts(jobType: string): number {
    const envKey = `JOBS_MAX_ATTEMPTS_${jobType.toUpperCase()}`;
    const raw = process.env[envKey] ?? process.env.JOBS_MAX_ATTEMPTS;
    const parsed = Number(raw ?? DEFAULT_MAX_ATTEMPTS);

    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ATTEMPTS;
  }

  private computeRetryDelay(attempt: number): number {
    const rawBaseDelay = Number(
      process.env.JOBS_RETRY_BASE_DELAY_MS ?? DEFAULT_RETRY_BASE_DELAY_MS,
    );
    const baseDelay =
      Number.isFinite(rawBaseDelay) && rawBaseDelay > 0
        ? rawBaseDelay
        : DEFAULT_RETRY_BASE_DELAY_MS;
    const exponent = Math.max(0, attempt - 1);

    return Math.min(baseDelay * 2 ** exponent, MAX_RETRY_DELAY_MS);
  }
}
