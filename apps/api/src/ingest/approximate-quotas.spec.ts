import { ApproximateQuotas, type QuotaDelta, type QuotaTotal } from "./approximate-quotas";

const HOUR = 3_600_000;
const key = { scope: "project_hour", scopeId: "project-1", windowMs: HOUR };

/** An in-memory counter table that other "processes" can also add to. */
function fakeStore() {
  const rows = new Map<string, number>();
  const id = (scope: string, scopeId: string, windowStartedAt: Date) =>
    `${scope}|${scopeId}|${windowStartedAt.getTime()}`;
  const writes: QuotaDelta[][] = [];
  let failing = false;
  return {
    writes,
    fail: (value: boolean) => {
      failing = value;
    },
    add: (scope: string, scopeId: string, windowStartedAt: Date, units: number) => {
      const rowId = id(scope, scopeId, windowStartedAt);
      rows.set(rowId, (rows.get(rowId) ?? 0) + units);
    },
    count: (scope: string, scopeId: string, windowStartedAt: Date) =>
      rows.get(id(scope, scopeId, windowStartedAt)) ?? 0,
    store: async (deltas: QuotaDelta[]): Promise<QuotaTotal[]> => {
      if (failing) throw new Error("database unavailable");
      writes.push(deltas);
      return deltas.map((delta) => {
        const rowId = id(delta.scope, delta.scopeId, delta.windowStartedAt);
        rows.set(rowId, (rows.get(rowId) ?? 0) + delta.units);
        return { ...delta, count: rows.get(rowId) ?? 0 };
      });
    },
  };
}

describe("ApproximateQuotas", () => {
  let now: number;
  const clock = () => now;
  const windowStart = () => new Date(Math.floor(now / HOUR) * HOUR);

  beforeEach(() => {
    now = Date.UTC(2026, 10, 5, 10, 15);
  });

  it("reads the total once, then counts far from the limit without touching the store", async () => {
    const db = fakeStore();
    db.add("project_hour", "project-1", windowStart(), 40);
    const quotas = new ApproximateQuotas(db.store, clock);

    for (let index = 0; index < 20; index += 1) {
      expect((await quotas.reserve(key, 1_000)).allowed).toBe(true);
    }
    expect(db.writes).toHaveLength(1);
    expect(db.count("project_hour", "project-1", windowStart())).toBe(40);

    await quotas.flush();
    expect(db.writes).toHaveLength(2);
    expect(db.count("project_hour", "project-1", windowStart())).toBe(60);
  });

  it("refuses exactly at the limit in a single process, with the time left in the window", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);

    const results = [];
    for (let index = 0; index < 5; index += 1) results.push(await quotas.reserve(key, 3));
    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false, false]);
    expect(results[3]).toEqual({ allowed: false, retryAfterSeconds: 45 * 60 });

    await quotas.flush();
    expect(db.count("project_hour", "project-1", windowStart())).toBe(3);
  });

  it("reads again near the limit, so other processes' units count", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);
    expect((await quotas.reserve(key, 10)).allowed).toBe(true);
    await quotas.flush();

    // Another process brings the row to the limit; this one still believes it is at 1.
    db.add("project_hour", "project-1", windowStart(), 9);
    expect((await quotas.reserve(key, 10)).allowed).toBe(true);
    now += 1_000;
    // 1 + 1 pending + 1 is still far from 10: no read, the stale total lets it through.
    expect((await quotas.reserve(key, 10)).allowed).toBe(true);

    // Near the limit the total is read again and the overshoot stops there.
    const before = db.writes.length;
    const many = [];
    for (let index = 0; index < 8; index += 1) many.push(await quotas.reserve(key, 10));
    expect(db.writes.length).toBeGreaterThan(before);
    expect(many.every((result) => !result.allowed)).toBe(false);
    expect(many.at(-1)?.allowed).toBe(false);
  });

  it("shares one read between concurrent callers", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);
    const results = await Promise.all(Array.from({ length: 5 }, () => quotas.reserve(key, 100)));
    expect(results.every((result) => result.allowed)).toBe(true);
    expect(db.writes).toHaveLength(1);
  });

  it("keeps units whose write failed for the next flush", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);
    await quotas.reserve(key, 100);
    await quotas.reserve(key, 100);

    db.fail(true);
    await expect(quotas.flush()).rejects.toThrow("database unavailable");
    db.fail(false);
    await quotas.flush();
    expect(db.count("project_hour", "project-1", windowStart())).toBe(2);
  });

  it("releases a reservation, even one already written", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);
    const kept = await quotas.reserve(key, 100);
    const released = await quotas.reserve(key, 100);
    await quotas.flush();
    expect(db.count("project_hour", "project-1", windowStart())).toBe(2);

    expect(kept.allowed && released.allowed).toBe(true);
    if (released.allowed) released.release();
    await quotas.flush();
    expect(db.count("project_hour", "project-1", windowStart())).toBe(1);
  });

  it("starts a new window from zero and forgets ended ones once written", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);
    const first = windowStart();
    expect((await quotas.reserve(key, 1)).allowed).toBe(true);
    expect((await quotas.reserve(key, 1)).allowed).toBe(false);

    now += HOUR;
    expect((await quotas.reserve(key, 1)).allowed).toBe(true);
    await quotas.flush();
    expect(db.count("project_hour", "project-1", first)).toBe(1);
    expect(db.count("project_hour", "project-1", windowStart())).toBe(1);

    const writes = db.writes.length;
    await quotas.flush();
    expect(db.writes).toHaveLength(writes);
  });

  it("counts several units at once against the limit", async () => {
    const db = fakeStore();
    const quotas = new ApproximateQuotas(db.store, clock);
    expect((await quotas.reserve(key, 10, 6)).allowed).toBe(true);
    expect((await quotas.reserve(key, 10, 6)).allowed).toBe(false);
    expect((await quotas.reserve(key, 10, 4)).allowed).toBe(true);
  });
});
