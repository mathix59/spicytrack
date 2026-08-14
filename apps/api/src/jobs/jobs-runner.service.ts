import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RetentionCleanupHandler } from "./handlers/retention-cleanup.handler";
import { JobsService } from "./jobs.service";
import type { Job } from "./jobs.service";

const POLL_INTERVAL_MS = 30_000;
const SLOW_POLL_INTERVAL_MS = 5_000;
const RETENTION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_DELAY_MS = 15_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

@Injectable()
export class JobsRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsRunnerService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private slowIntervalHandle: NodeJS.Timeout | null = null;
  private slowJobActive = false;
  private readonly handlers: Record<string, (job: Job) => Promise<void>>;
  // Long-running jobs (minutes) get their own lane so they never block the
  // regular tick; at most one slow job runs per API instance.
  private readonly slowHandlers: Record<string, (job: Job) => Promise<void>> = {};

  constructor(
    private readonly jobsService: JobsService,
    private readonly retentionCleanupHandler: RetentionCleanupHandler,
  ) {
    this.handlers = {
      retention_cleanup: () => this.retentionCleanupHandler.run(),
    };
  }

  registerHandler(type: string, handler: (job: Job) => Promise<void>): void {
    this.handlers[type] = handler;
  }

  registerSlowHandler(type: string, handler: (job: Job) => Promise<void>): void {
    this.slowHandlers[type] = handler;
  }

  async onModuleInit(): Promise<void> {
    if (!(await this.jobsService.hasPending("retention_cleanup"))) {
      await this.jobsService.enqueue("retention_cleanup");
    }

    this.intervalHandle = setInterval(() => {
      void this.tick().catch((error: unknown) => this.logPollingFailure("regular", error));
    }, POLL_INTERVAL_MS);

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

  private async tick(): Promise<void> {
    const job = await this.jobsService.claimNext(Object.keys(this.handlers));

    if (!job) {
      return;
    }

    try {
      await this.handlers[job.type](job);
      await this.jobsService.markSucceeded(job.id);
    } catch (error) {
      await this.handleFailure(job, error);
    }

    if (job.type === "retention_cleanup") {
      await this.jobsService.enqueue(
        "retention_cleanup",
        {},
        new Date(Date.now() + RETENTION_CLEANUP_INTERVAL_MS),
      );
    }
  }

  private async slowTick(): Promise<void> {
    const types = Object.keys(this.slowHandlers);

    if (this.slowJobActive || types.length === 0) {
      return;
    }

    const job = await this.jobsService.claimNext(types);

    if (!job) {
      return;
    }

    this.slowJobActive = true;

    try {
      await this.slowHandlers[job.type](job);
      await this.jobsService.markSucceeded(job.id);
    } catch (error) {
      await this.handleFailure(job, error);
    } finally {
      this.slowJobActive = false;
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
