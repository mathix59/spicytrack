import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { jobs } from "../database/schema";

export type Job = typeof jobs.$inferSelect;
type EnqueueOptions = {
  dedupeKey?: string;
  organizationId?: string;
  projectId?: string;
};
export type JobQueueSummary = {
  pending: number;
  running: number;
  failed: number;
  due: number;
};
export type OrganizationJobRecord = Pick<
  Job,
  | "id"
  | "organizationId"
  | "projectId"
  | "type"
  | "status"
  | "dedupeKey"
  | "attempts"
  | "lastError"
  | "runAt"
  | "startedAt"
  | "finishedAt"
  | "createdAt"
> & { payload: Record<string, unknown> };
type OrganizationJobFilters = {
  status?: "pending" | "running" | "failed";
  type?: string;
  projectId?: string;
  limit?: number;
};

@Injectable()
export class JobsService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async enqueue(
    type: string,
    payload: Record<string, unknown> = {},
    runAt: Date = new Date(),
    options: EnqueueOptions = {},
  ): Promise<void> {
    try {
      await this.db.insert(jobs).values({
        organizationId: options.organizationId ?? null,
        projectId: options.projectId ?? null,
        type,
        dedupeKey: options.dedupeKey ?? null,
        payload,
        runAt,
      });
    } catch (error) {
      if (options.dedupeKey && this.isDuplicateKeyError(error)) {
        return;
      }

      throw error;
    }
  }

  async hasPending(type: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.type, type), inArray(jobs.status, ["pending", "running"])))
      .limit(1);

    return Boolean(row);
  }

  async claimNext(types: string[]): Promise<Job | null> {
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(jobs)
        .where(
          and(inArray(jobs.type, types), eq(jobs.status, "pending"), lte(jobs.runAt, new Date())),
        )
        .orderBy(jobs.runAt)
        .limit(1)
        .for("update", { skipLocked: true });

      if (!candidate) {
        return null;
      }

      const [claimed] = await tx
        .update(jobs)
        .set({
          status: "running",
          startedAt: new Date(),
          attempts: sql`${jobs.attempts} + 1`,
        })
        .where(eq(jobs.id, candidate.id))
        .returning();

      return claimed;
    });
  }

  async markSucceeded(jobId: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(jobs.id, jobId));
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.db
      .update(jobs)
      .set({ status: "failed", finishedAt: new Date(), lastError: error })
      .where(eq(jobs.id, jobId));
  }

  async reschedule(jobId: string, error: string, runAt: Date): Promise<void> {
    await this.db
      .update(jobs)
      .set({
        status: "pending",
        runAt,
        finishedAt: null,
        startedAt: null,
        lastError: error,
      })
      .where(eq(jobs.id, jobId));
  }

  async getQueueSummary(): Promise<JobQueueSummary> {
    const [row] = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${jobs.status} = 'pending')::int`,
        running: sql<number>`count(*) filter (where ${jobs.status} = 'running')::int`,
        failed: sql<number>`count(*) filter (where ${jobs.status} = 'failed')::int`,
        due: sql<number>`count(*) filter (where ${jobs.status} = 'pending' and ${jobs.runAt} <= now())::int`,
      })
      .from(jobs);

    return {
      pending: row?.pending ?? 0,
      running: row?.running ?? 0,
      failed: row?.failed ?? 0,
      due: row?.due ?? 0,
    };
  }

  async getOrganizationQueueSummary(organizationId: string): Promise<JobQueueSummary> {
    const [row] = await this.db
      .select({
        pending: sql<number>`count(*) filter (where ${jobs.status} = 'pending' and ${jobs.organizationId} = ${organizationId})::int`,
        running: sql<number>`count(*) filter (where ${jobs.status} = 'running' and ${jobs.organizationId} = ${organizationId})::int`,
        failed: sql<number>`count(*) filter (where ${jobs.status} = 'failed' and ${jobs.organizationId} = ${organizationId})::int`,
        due: sql<number>`count(*) filter (where ${jobs.status} = 'pending' and ${jobs.organizationId} = ${organizationId} and ${jobs.runAt} <= now())::int`,
      })
      .from(jobs);

    return {
      pending: row?.pending ?? 0,
      running: row?.running ?? 0,
      failed: row?.failed ?? 0,
      due: row?.due ?? 0,
    };
  }

  async listOrganizationRecentJobs(
    organizationId: string,
    filters: OrganizationJobFilters = {},
  ): Promise<OrganizationJobRecord[]> {
    const where = [
      eq(jobs.organizationId, organizationId),
      inArray(jobs.status, filters.status ? [filters.status] : ["pending", "running", "failed"]),
    ];

    if (filters.type) {
      where.push(eq(jobs.type, filters.type));
    }

    if (filters.projectId) {
      where.push(eq(jobs.projectId, filters.projectId));
    }

    const rows = await this.db
      .select({
        id: jobs.id,
        organizationId: jobs.organizationId,
        projectId: jobs.projectId,
        type: jobs.type,
        status: jobs.status,
        dedupeKey: jobs.dedupeKey,
        payload: jobs.payload,
        attempts: jobs.attempts,
        lastError: jobs.lastError,
        runAt: jobs.runAt,
        startedAt: jobs.startedAt,
        finishedAt: jobs.finishedAt,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(and(...where))
      .orderBy(desc(jobs.createdAt))
      .limit(filters.limit ?? 25);

    return rows.map((row) => ({
      ...row,
      payload:
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {},
    }));
  }

  async requeueFailedOrganizationJob(
    organizationId: string,
    jobId: string,
  ): Promise<OrganizationJobRecord | null> {
    const [row] = await this.db
      .update(jobs)
      .set({
        status: "pending",
        runAt: new Date(),
        attempts: 0,
        startedAt: null,
        finishedAt: null,
        lastError: null,
      })
      .where(
        and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId), eq(jobs.status, "failed")),
      )
      .returning({
        id: jobs.id,
        organizationId: jobs.organizationId,
        projectId: jobs.projectId,
        type: jobs.type,
        status: jobs.status,
        dedupeKey: jobs.dedupeKey,
        payload: jobs.payload,
        attempts: jobs.attempts,
        lastError: jobs.lastError,
        runAt: jobs.runAt,
        startedAt: jobs.startedAt,
        finishedAt: jobs.finishedAt,
        createdAt: jobs.createdAt,
      });

    if (!row) {
      return null;
    }

    return {
      ...row,
      payload:
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {},
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return "code" in error && error.code === "23505";
  }
}
