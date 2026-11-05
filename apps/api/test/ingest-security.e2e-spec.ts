import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { and, eq, inArray, sql } from "drizzle-orm";

import { AppModule } from "../src/app.module";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import {
  alertRules,
  auditLogs,
  events,
  ingestRateCounters,
  issueActivity,
  issuePendingCounts,
  issues,
  jobs,
  organizations,
  projectKeys,
  projects,
  users,
} from "../src/database/schema";
import { IngestQuotasService } from "../src/ingest/ingest-quotas.service";
import { IngestService } from "../src/ingest/ingest.service";
import { IngestModule } from "../src/ingest/ingest.module";
import { IssuesService } from "../src/issues/issues.service";
import { RetentionCleanupHandler } from "../src/jobs/handlers/retention-cleanup.handler";
import { JobsWorkerModule } from "../src/jobs/jobs-worker.module";

describe("Ingestion security and concurrency (e2e)", () => {
  let db: DatabaseClient;
  let ingest: IngestService;
  let quotas: IngestQuotasService;
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
    quotas = module.get(IngestQuotasService);
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
    await db.delete(alertRules).where(eq(alertRules.organizationId, organizationId));
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

  it("enforces the hourly project quota from counts kept in memory", async () => {
    const counter = async () => {
      await quotas.flush();
      const [row] = await db
        .select({ count: ingestRateCounters.count })
        .from(ingestRateCounters)
        .where(
          and(
            eq(ingestRateCounters.scope, "project_hour"),
            eq(ingestRateCounters.scopeId, primaryProjectId),
            eq(
              ingestRateCounters.windowStartedAt,
              new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000),
            ),
          ),
        );
      return row?.count ?? 0;
    };
    const previous = process.env.INGEST_PROJECT_EVENTS_PER_HOUR;
    const start = await counter();
    process.env.INGEST_PROJECT_EVENTS_PER_HOUR = String(start + 2);
    try {
      const responses = [];
      for (let index = 0; index < 4; index += 1) {
        responses.push(
          await ingest
            .ingestStore(
              String(primaryPublicId),
              event(randomUUID().replaceAll("-", "")),
              primaryKey,
            )
            .then(
              () => 200,
              (error: { status?: number }) => error.status,
            ),
        );
      }
      expect(responses).toEqual([200, 200, 429, 429]);
      // Refused events are not counted, and the accepted ones reach the table on flush.
      expect(await counter()).toBe(start + 2);
    } finally {
      if (previous === undefined) delete process.env.INGEST_PROJECT_EVENTS_PER_HOUR;
      else process.env.INGEST_PROJECT_EVENTS_PER_HOUR = previous;
    }
  });

  it("queues post-ingest jobs per new issue, and per issue and window for threshold rules", async () => {
    const message = `Post-ingest job ${randomUUID()}`;
    const queued = async () =>
      db
        .select({ dedupeKey: jobs.dedupeKey })
        .from(jobs)
        .where(and(eq(jobs.type, "post_ingest_admin"), eq(jobs.projectId, siblingProjectId)));
    const send = () =>
      ingest.ingestStore(
        String(siblingPublicId),
        { ...event(randomUUID().replaceAll("-", "")), message },
        siblingKey,
      );
    const rule = {
      organizationId,
      projectId: siblingProjectId,
      name: "Post-ingest job",
      destinationTarget: "https://example.test/hook",
    };

    const { eventId: createdEventId, issueId } = await send();
    expect(await queued()).toEqual([{ dedupeKey: createdEventId }]);
    // Rules without an event threshold only need the event that creates or regresses an issue.
    await db.insert(alertRules).values({ ...rule, triggerTypes: ["new_issue", "regression"] });
    await db
      .insert(alertRules)
      .values({ ...rule, triggerTypes: ["event_threshold"], threshold: 10, isActive: false });
    await send();
    expect(await queued()).toHaveLength(1);

    await db
      .insert(alertRules)
      .values({ ...rule, triggerTypes: ["event_threshold"], threshold: 10 });
    await Promise.all([send(), send(), send()]);
    const coalesced = (await queued()).filter(({ dedupeKey }) => dedupeKey !== createdEventId);
    expect(coalesced.length).toBeGreaterThanOrEqual(1);
    expect(coalesced.length).toBeLessThanOrEqual(2);
    expect(coalesced.every(({ dedupeKey }) => dedupeKey?.startsWith(`issue:${issueId}:`))).toBe(
      true,
    );
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

  it("counts an event not yet flushed on the merge target on its own issue after unmerge", async () => {
    const send = (message: string) =>
      ingest.ingestStore(
        String(primaryPublicId),
        { ...event(randomUUID().replaceAll("-", "")), message },
        primaryKey,
      );
    const [sourceMessage, targetMessage] = [`Unmerge source ${userId}`, `Unmerge target ${userId}`];
    const { issueId: sourceId } = await send(sourceMessage);
    await send(sourceMessage);
    const { issueId: targetId, eventId: targetEventId } = await send(targetMessage);
    await issuesService.mergeIssue({
      organizationId,
      projectId: primaryProjectId,
      issueId: sourceId!,
      targetIssueId: targetId!,
      actorUserId: userId,
    });
    // A later event of the source lands on the target, its count still pending there.
    const { eventId: lateEventId } = await send(sourceMessage);
    await db
      .update(issues)
      .set({ timesSeen: sql`${issues.timesSeen} - 1` })
      .where(eq(issues.id, targetId!));
    await db.insert(issuePendingCounts).values({
      issueId: targetId!,
      eventId: lateEventId!,
      seenAt: new Date(Date.now() + 60_000),
      title: sourceMessage,
      level: "error",
    });

    await issuesService.unmergeIssue({
      organizationId,
      projectId: primaryProjectId,
      issueId: sourceId!,
      actorUserId: userId,
    });

    const [source] = await db.select().from(issues).where(eq(issues.id, sourceId!));
    const [target] = await db.select().from(issues).where(eq(issues.id, targetId!));
    expect(source.timesSeen).toBe(3);
    expect(target).toMatchObject({ timesSeen: 1, lastEventId: targetEventId });
    const pending = await db
      .select()
      .from(issuePendingCounts)
      .where(inArray(issuePendingCounts.issueId, [sourceId!, targetId!]));
    expect(pending).toHaveLength(0);
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
