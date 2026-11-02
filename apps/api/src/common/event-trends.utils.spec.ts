import {
  buildZeroFilledCounts,
  resolveEventTrendWindow,
  sumEventTrends,
} from "./event-trends.utils";

describe("event trend utils", () => {
  const now = new Date("2026-11-03T15:42:10.000Z");

  it("builds 24 hourly buckets ending at the current UTC hour", () => {
    const window = resolveEventTrendWindow("24h", now);

    expect(window.bucketSeconds).toBe(3600);
    expect(window.bucketCount).toBe(24);
    expect(window.start.toISOString()).toBe("2026-11-02T16:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-03T16:00:00.000Z");
  });

  it("builds 14 daily buckets ending today (UTC)", () => {
    const window = resolveEventTrendWindow("14d", now);

    expect(window.bucketSeconds).toBe(86400);
    expect(window.bucketCount).toBe(14);
    expect(window.start.toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });

  it("zero-fills missing buckets and ignores out-of-range or null buckets", () => {
    const window = resolveEventTrendWindow("14d", now);

    const counts = buildZeroFilledCounts(window, [
      { bucket: 0, count: 2 },
      { bucket: 13, count: 5 },
      { bucket: null, count: 0 },
      { bucket: -1, count: 9 },
      { bucket: 14, count: 9 },
    ]);

    expect(counts).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5]);
  });

  it("sums trends element-wise", () => {
    expect(
      sumEventTrends(3, [
        [1, 0, 2],
        [0, 4, 1],
      ]),
    ).toEqual([1, 4, 3]);
    expect(sumEventTrends(2, [])).toEqual([0, 0]);
  });
});
