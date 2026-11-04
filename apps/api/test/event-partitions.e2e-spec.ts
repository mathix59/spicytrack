import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import * as schema from "../src/database/schema";
import { EventPartitionsService, weekStart } from "../src/jobs/handlers/event-partitions";
import { privateDatabase } from "./private-database";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// A private database, since this test drops whole partitions of the events table.
describe("event partitions (e2e)", () => {
  const database = privateDatabase("partitions_test");
  const db = database.db;
  const service = new EventPartitionsService(db as never);
  const organizationId = randomUUID();
  const projectId = randomUUID();
  const issueId = randomUUID();
  const thisWeek = weekStart(new Date());

  const insertEvent = (eventId: string, ingestedAt: Date) =>
    db.insert(schema.events).values({
      organizationId,
      projectId,
      issueId,
      eventId,
      timestamp: ingestedAt,
      ingestedAt,
      rawPayload: {},
    });
  const partitionOf = async (eventId: string) => {
    const result = await db.execute<{ partition: string }>(
      sql`select tableoid::regclass::text as partition from events where event_id = ${eventId}`,
    );
    return result.rows[0]?.partition ?? null;
  };
  const names = async () => (await service.partitions()).map((partition) => partition.name).sort();

  beforeAll(async () => {
    await database.create();
    // The longest retention decides which partitions can go.
    await db.insert(schema.projects).values([
      { id: projectId, organizationId, name: "P", slug: "p", retentionDays: 30 },
      { organizationId, name: "Long", slug: "long", retentionDays: 90 },
    ]);
  });

  afterAll(async () => {
    await database.drop();
  });

  it("migrates to a legacy partition, four weeks ahead and a default", async () => {
    const week = (offset: number) =>
      `events_p${new Date(thisWeek.getTime() + offset * WEEK_MS).toISOString().slice(0, 10).replaceAll("-", "")}`;
    expect(await names()).toEqual(["events_legacy", week(1), week(2), week(3), week(4)].sort());
    await insertEvent("now", new Date());
    expect(await partitionOf("now")).toBe("events_legacy");
  });

  it("creates missing weeks and moves rows the default partition caught", async () => {
    const later = new Date(thisWeek.getTime() + 8 * WEEK_MS + DAY_MS);
    await insertEvent("caught", later);
    expect(await partitionOf("caught")).toBe("events_default");

    await service.maintain(later);
    const partition = `events_p${weekStart(later).toISOString().slice(0, 10).replaceAll("-", "")}`;
    expect(await partitionOf("caught")).toBe(partition);
    expect(await names()).toContain(partition);
    // Running again finds nothing to create.
    const before = await names();
    await service.maintain(later);
    expect(await names()).toEqual(before);
  });

  it("drops only partitions past the longest project retention", async () => {
    const recent = new Date(thisWeek.getTime() + 2 * WEEK_MS + DAY_MS);
    await insertEvent("recent", recent);
    // 30 days after the legacy partition ends, but not yet 30 days after the third week ends.
    const now = new Date(thisWeek.getTime() + WEEK_MS + 31 * DAY_MS);

    expect(await service.maintain(now)).toEqual([]);
    expect(await partitionOf("now")).toBe("events_legacy");

    await db.execute(sql`update projects set retention_days = 30`);
    const dropped = await service.maintain(now);
    expect(dropped).toContain("events_legacy");
    expect(await partitionOf("now")).toBeNull();
    expect(await partitionOf("recent")).not.toBeNull();
    expect(await names()).not.toContain("events_legacy");
  });
});
