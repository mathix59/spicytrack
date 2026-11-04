import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/database/schema";
import { IssueCountsService } from "../src/ingest/issue-counts.service";
import { privateDatabase } from "./private-database";

describe("issue counts (e2e)", () => {
  const database = privateDatabase("counts_test");
  const db = database.db;
  const service = new IssueCountsService(db as never);
  const organizationId = randomUUID();
  const projectId = randomUUID();
  const firstSeen = new Date("2026-11-01T10:00:00Z");

  const createIssue = async () => {
    const [issue] = await db
      .insert(schema.issues)
      .values({
        organizationId,
        projectId,
        groupingKey: randomUUID(),
        title: "TypeError: first",
        level: "error",
        firstSeenAt: firstSeen,
        lastSeenAt: firstSeen,
        timesSeen: 1,
      })
      .returning();
    return issue;
  };
  const pending = (issueId: string, seenAt: Date, title = "TypeError: later") =>
    db.transaction((tx) =>
      service.add(tx as never, {
        issueId,
        eventId: randomUUID(),
        seenAt,
        title,
        culprit: "app.js",
        level: "warning",
      }),
    );
  const issue = async (id: string) => {
    const [row] = await db.select().from(schema.issues).where(eq(schema.issues.id, id));
    return row;
  };
  const pendingCount = async () => {
    const result = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from issue_pending_counts`,
    );
    return result.rows[0].count;
  };

  beforeAll(async () => {
    await database.create();
  });

  afterAll(async () => {
    await database.drop();
  });

  it("folds every pending row into the issue, whatever the flush concurrency", async () => {
    const { id } = await createIssue();
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        pending(id, new Date(firstSeen.getTime() + (index + 1) * 1000)),
      ),
    );

    await Promise.all(Array.from({ length: 8 }, () => service.flush(id)));
    await service.flush(id);

    const row = await issue(id);
    expect(row.timesSeen).toBe(41);
    expect(row.lastSeenAt).toEqual(new Date(firstSeen.getTime() + 40_000));
    expect(row).toMatchObject({ title: "TypeError: later", level: "warning", culprit: "app.js" });
    expect(await pendingCount()).toBe(0);
  });

  it("skips an issue whose row is held, and leaves its rows for the next flush", async () => {
    const { id } = await createIssue();
    await pending(id, new Date(firstSeen.getTime() + 1000));

    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const holder = db.transaction(async (tx) => {
      await tx.execute(sql`select id from issues where id = ${id} for no key update`);
      await held;
    });
    // Let the holder take the row lock first.
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect(service.flush(id)).resolves.toBeNull();
    expect((await issue(id)).timesSeen).toBe(1);

    release();
    await holder;
    await expect(service.flush(id)).resolves.toBe(2);
  });

  it("counts a late event without letting it replace the latest one", async () => {
    const { id } = await createIssue();
    await pending(id, new Date(firstSeen.getTime() + 60_000), "Newest");
    await service.flush(id);
    await pending(id, new Date(firstSeen.getTime() - 60_000), "Late");
    await service.flush(id);

    const row = await issue(id);
    expect(row.timesSeen).toBe(3);
    expect(row.title).toBe("Newest");
    expect(row.lastSeenAt).toEqual(new Date(firstSeen.getTime() + 60_000));
  });

  it("sweeps every issue left with pending rows", async () => {
    const [left, right] = [await createIssue(), await createIssue()];
    await pending(left.id, new Date(firstSeen.getTime() + 1000));
    await pending(right.id, new Date(firstSeen.getTime() + 1000));
    await pending(right.id, new Date(firstSeen.getTime() + 2000));

    await expect(service.flushAll()).resolves.toBe(2);

    expect((await issue(left.id)).timesSeen).toBe(2);
    expect((await issue(right.id)).timesSeen).toBe(3);
    expect(await pendingCount()).toBe(0);
  });

  it("drops pending rows with their issue", async () => {
    const { id } = await createIssue();
    await pending(id, new Date(firstSeen.getTime() + 1000));

    await db.delete(schema.issues).where(eq(schema.issues.id, id));

    expect(await pendingCount()).toBe(0);
  });
});
