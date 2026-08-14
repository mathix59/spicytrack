import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";

import { AppModule } from "../src/app.module";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import {
  auditLogs,
  events,
  ingestRateCounters,
  issueActivity,
  issues,
  jobs,
  organizations,
  projectKeys,
  projects,
  users,
} from "../src/database/schema";
import { IngestService } from "../src/ingest/ingest.service";
import { IngestModule } from "../src/ingest/ingest.module";
import { IssuesService } from "../src/issues/issues.service";
import { RetentionCleanupHandler } from "../src/jobs/handlers/retention-cleanup.handler";
import { JobsWorkerModule } from "../src/jobs/jobs-worker.module";

describe("Ingestion security and concurrency (e2e)", () => {
  let db: DatabaseClient;
  let ingest: IngestService;
  let issuesService: IssuesService;
  let retention: RetentionCleanupHandler;
  let close: () => Promise<void>;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const primaryProjectId = randomUUID();
  const siblingProjectId = randomUUID();
  const primaryKeyId = randomUUID();
  const siblingKeyId = randomUUID();
  const inactiveKeyId = randomUUID();
  const rateKeyId = randomUUID();
  const primaryKey = `ingest-primary-${randomUUID()}`;
  const siblingKey = `ingest-sibling-${randomUUID()}`;
  const inactiveKey = `ingest-inactive-${randomUUID()}`;
  const rateKey = `ingest-rate-${randomUUID()}`;
  const staleCounterId = randomUUID();
  const freshCounterId = randomUUID();
  const mergeIssueA = randomUUID();
  const mergeIssueB = randomUUID();
  let primaryPublicId: number;
  let siblingPublicId: number;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule, IngestModule, JobsWorkerModule],
    }).compile();
    await module.init();
    close = () => module.close();
    db = module.get(DATABASE);
    ingest = module.get(IngestService);
    issuesService = module.get(IssuesService);
    retention = module.get(RetentionCleanupHandler);

    await db.insert(users).values({
      id: userId,
      email: `ingest-security-${userId}@example.test`,
      passwordHash: "",
      name: "Ingest Security",
    });
    await db.insert(organizations).values({
      id: organizationId,
      ownerUserId: userId,
      name: "Ingest Security",
      slug: `ingest-security-${userId}`,
    });
    const inserted = await db
      .insert(projects)
      .values([
        {
          id: primaryProjectId,
          organizationId,
          name: "Primary ingest",
          slug: `primary-${userId}`,
        },
        {
          id: siblingProjectId,
          organizationId,
          name: "Sibling ingest",
          slug: `sibling-${userId}`,
        },
      ])
      .returning({ id: projects.id, publicId: projects.publicId });
    primaryPublicId = inserted.find(({ id }) => id === primaryProjectId)!.publicId;
    siblingPublicId = inserted.find(({ id }) => id === siblingProjectId)!.publicId;
    await db.insert(projectKeys).values([
      {
        id: primaryKeyId,
        organizationId,
        projectId: primaryProjectId,
        name: "Primary",
        publicKey: primaryKey,
      },
      {
        id: siblingKeyId,
        organizationId,
        projectId: siblingProjectId,
        name: "Sibling",
        publicKey: siblingKey,
      },
      {
        id: inactiveKeyId,
        organizationId,
        projectId: primaryProjectId,
        name: "Inactive",
        publicKey: inactiveKey,
        isActive: false,
      },
      {
        id: rateKeyId,
        organizationId,
        projectId: primaryProjectId,
        name: "Rate limited",
        publicKey: rateKey,
        rateLimitPerMinute: 2,
      },
    ]);
    await db.insert(issues).values([
      {
        id: mergeIssueA,
        organizationId,
        projectId: primaryProjectId,
        groupingKey: `merge-a-${userId}`,
        title: "Merge A",
        timesSeen: 3,
      },
      {
        id: mergeIssueB,
        organizationId,
        projectId: primaryProjectId,
        groupingKey: `merge-b-${userId}`,
        title: "Merge B",
        timesSeen: 4,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(jobs).where(eq(jobs.organizationId, organizationId));
    await db.delete(issueActivity).where(eq(issueActivity.organizationId, organizationId));
    await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
    await db.delete(events).where(eq(events.organizationId, organizationId));
    await db.delete(issues).where(eq(issues.organizationId, organizationId));
    await db
      .delete(ingestRateCounters)
      .where(
        inArray(ingestRateCounters.scopeId, [
          organizationId,
          primaryProjectId,
          siblingProjectId,
          primaryKeyId,
          siblingKeyId,
          inactiveKeyId,
          rateKeyId,
          staleCounterId,
          freshCounterId,
        ]),
      );
    await db.delete(projectKeys).where(eq(projectKeys.organizationId, organizationId));
    await db.delete(projects).where(eq(projects.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, userId));
    await close();
  });

  const event = (eventId: string) => ({
    event_id: eventId,
    message: "Concurrent ingest failure",
    timestamp: new Date().toISOString(),
    platform: "javascript",
  });

  it("binds every key to its exact public project id and active state", async () => {
    await expect(
      ingest.ingestStore(String(siblingPublicId), event(randomUUID()), primaryKey),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      ingest.ingestStore(String(primaryPublicId), event(randomUUID()), siblingKey),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      ingest.ingestStore(String(primaryPublicId), event(randomUUID()), inactiveKey),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      ingest.ingestStore(String(primaryPublicId), event(randomUUID())),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("stores the same external event exactly once under concurrency", async () => {
    const externalId = randomUUID().replaceAll("-", "");
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        ingest.ingestStore(String(primaryPublicId), event(externalId), primaryKey),
      ),
    );
    expect(new Set(results.map(({ eventId }) => eventId)).size).toBe(1);
    const stored = await db.select().from(events).where(eq(events.eventId, externalId));
    expect(stored).toHaveLength(1);
  });

  it("enforces an atomic per-key quota", async () => {
    const responses = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        ingest.ingestStore(
          String(primaryPublicId),
          event(randomUUID().replaceAll("-", "")),
          rateKey,
        ),
      ),
    );
    expect(responses.filter(({ status }) => status === "fulfilled")).toHaveLength(2);
    const rejection = responses.find(({ status }) => status === "rejected");
    expect(rejection).toMatchObject({ status: "rejected", reason: { status: 429 } });
  });

  it("serializes reciprocal issue merges without losing counters", async () => {
    const input = (issueId: string, targetIssueId: string) => ({
      organizationId,
      projectId: primaryProjectId,
      issueId,
      targetIssueId,
      actorUserId: userId,
    });
    const results = await Promise.allSettled([
      issuesService.mergeIssue(input(mergeIssueA, mergeIssueB)),
      issuesService.mergeIssue(input(mergeIssueB, mergeIssueA)),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const stored = await db
      .select()
      .from(issues)
      .where(inArray(issues.id, [mergeIssueA, mergeIssueB]));
    expect(stored.filter(({ status }) => status === "merged")).toHaveLength(1);
    expect(stored.find(({ status }) => status !== "merged")?.timesSeen).toBe(7);
  });

  it("rejects oversized payloads and safely drops unsupported envelopes", async () => {
    const previousLimit = process.env.INGEST_MAX_EVENT_BYTES;
    try {
      process.env.INGEST_MAX_EVENT_BYTES = "100";
      await expect(
        ingest.ingestStore(
          String(primaryPublicId),
          { ...event(randomUUID()), extra: { oversized: "x".repeat(1_000) } },
          primaryKey,
        ),
      ).rejects.toMatchObject({ status: 413 });
    } finally {
      if (previousLimit === undefined) delete process.env.INGEST_MAX_EVENT_BYTES;
      else process.env.INGEST_MAX_EVENT_BYTES = previousLimit;
    }

    const dropped = await ingest.ingestEnvelope(
      String(primaryPublicId),
      `${JSON.stringify({ event_id: randomUUID() })}\n${JSON.stringify({ type: "attachment" })}\nignored`,
      primaryKey,
    );
    expect(dropped).toMatchObject({ accepted: true, dropped: true });
  });

  it("removes stale shared rate counters but preserves fresh windows", async () => {
    const windowStartedAt = new Date(Date.now() - 60_000);
    await db.insert(ingestRateCounters).values([
      {
        scope: "security_test",
        scopeId: staleCounterId,
        windowStartedAt,
        count: 1,
        updatedAt: new Date(Date.now() - 72 * 60 * 60 * 1_000),
      },
      {
        scope: "security_test",
        scopeId: freshCounterId,
        windowStartedAt,
        count: 1,
        updatedAt: new Date(),
      },
    ]);
    await retention.run();
    expect(
      await db
        .select()
        .from(ingestRateCounters)
        .where(eq(ingestRateCounters.scopeId, staleCounterId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(ingestRateCounters)
        .where(eq(ingestRateCounters.scopeId, freshCounterId)),
    ).toHaveLength(1);
  });
});
