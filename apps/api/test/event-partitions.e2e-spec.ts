import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import * as schema from "../src/database/schema";
import { EventPartitionsService, weekStart } from "../src/jobs/handlers/event-partitions";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// A private schema, since this test drops whole partitions of the events table.
describe("event partitions (e2e)", () => {
  const schemaName = `partitions_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schemaName}`,
  });
  const db = drizzle(pool, { schema });
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
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    await migrate(db, {
      migrationsFolder: resolve(__dirname, "../drizzle"),
      migrationsSchema: schemaName,
    });
    // The longest retention decides which partitions can go.
    await db.insert(schema.projects).values([
      { id: projectId, organizationId, name: "P", slug: "p", retentionDays: 30 },
      { organizationId, name: "Long", slug: "long", retentionDays: 90 },
    ]);
  });

  afterAll(async () => {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await admin.end();
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
