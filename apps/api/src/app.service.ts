import { Inject, Injectable, Optional } from "@nestjs/common";
import type { Pool } from "pg";
import { DATABASE_POOL, DATABASE_READ_REPLICA_POOL } from "./database/database.provider";
import { EmailService } from "./email/email.service";
import { JobsService } from "./jobs/jobs.service";
import { ingestLimits } from "./ingest/ingest-limits";
import { renderIngestMetrics } from "./ingest/ingest-metrics";
import { STORAGE_SERVICE, type StorageService } from "./storage/storage.service";

const HEALTH_TIMEOUT_MS = 3_000;

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let handle: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        handle = setTimeout(() => reject(new Error("health check timed out")), HEALTH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

@Injectable()
export class AppService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly emailService: EmailService,
    @Optional() private readonly jobsService?: JobsService,
    @Optional()
    @Inject(DATABASE_READ_REPLICA_POOL)
    private readonly readReplicaPool?: Pool | null,
  ) {}

  getHello(): string {
    return "SpicyTrack API";
  }

  getLiveness() {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    let jobSummary: Awaited<ReturnType<JobsService["getQueueSummary"]>> | undefined;
    const checks = await Promise.all([
      this.checkDependency("database", async () => {
        await this.pool.query("SELECT 1");
        return "ok";
      }),
      ...(this.readReplicaPool
        ? [
            this.checkDependency("databaseReplica", async () => {
              await this.readReplicaPool?.query("SELECT 1");
              return "ok";
            }),
          ]
        : []),
      this.checkDependency("storage", async () => {
        await this.storage.checkHealth();
        return "ok";
      }),
      this.checkDependency("smtp", () => this.emailService.checkHealth()),
      this.checkDependency("jobs", async () => {
        if (!this.jobsService) return "disabled";
        jobSummary = await this.jobsService.getQueueSummary();
        return "ok";
      }),
    ]);
    const dependencies = Object.fromEntries(checks.map((check) => [check.name, check.status]));
    return {
      status: checks.some((check) => check.status === "error") ? "error" : "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      dependencies,
      ...(jobSummary ? { jobs: jobSummary } : {}),
    };
  }

  async getMetrics(): Promise<string> {
    const memory = process.memoryUsage();
    const lines = [
      "# HELP spicytrack_process_uptime_seconds Process uptime in seconds.",
      "# TYPE spicytrack_process_uptime_seconds gauge",
      `spicytrack_process_uptime_seconds ${process.uptime()}`,
      "# HELP spicytrack_process_resident_memory_bytes Resident memory size in bytes.",
      "# TYPE spicytrack_process_resident_memory_bytes gauge",
      `spicytrack_process_resident_memory_bytes ${memory.rss}`,
      "# HELP spicytrack_process_heap_used_bytes Used JavaScript heap in bytes.",
      "# TYPE spicytrack_process_heap_used_bytes gauge",
      `spicytrack_process_heap_used_bytes ${memory.heapUsed}`,
      ...renderIngestMetrics(),
    ];

    const limits = ingestLimits();
    lines.push(
      "# HELP spicytrack_ingest_limit Configured ingestion limits; zero means unlimited.",
      "# TYPE spicytrack_ingest_limit gauge",
      `spicytrack_ingest_limit{type="payload_bytes"} ${limits.maxEventBytes}`,
      `spicytrack_ingest_limit{type="project_events_per_hour"} ${limits.projectEventsPerHour}`,
      `spicytrack_ingest_limit{type="organization_events_per_hour"} ${limits.organizationEventsPerHour}`,
    );

    if (this.jobsService) {
      const summary = await this.jobsService.getQueueSummary();
      lines.push(
        "# HELP spicytrack_jobs Number of jobs by queue state.",
        "# TYPE spicytrack_jobs gauge",
        `spicytrack_jobs{status="pending"} ${summary.pending}`,
        `spicytrack_jobs{status="running"} ${summary.running}`,
        `spicytrack_jobs{status="failed"} ${summary.failed}`,
        `spicytrack_jobs{status="due"} ${summary.due}`,
      );
    }

    return `${lines.join("\n")}\n`;
  }

  private async checkDependency(name: string, operation: () => Promise<string>) {
    try {
      return { name, status: await withTimeout(operation()) };
    } catch {
      return { name, status: "error" };
    }
  }
}
