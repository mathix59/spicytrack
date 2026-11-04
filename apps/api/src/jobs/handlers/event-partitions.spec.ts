import {
  expiredPartitions,
  missingWeeks,
  parsePartitionBound,
  partitionName,
  weekStart,
} from "./event-partitions";

const date = (value: string) => new Date(value);

describe("event partitions", () => {
  it("aligns weeks on Monday 00:00 UTC", () => {
    expect(weekStart(date("2026-11-04T10:00:00Z"))).toEqual(date("2026-11-02T00:00:00Z"));
    expect(weekStart(date("2026-11-08T23:59:59Z"))).toEqual(date("2026-11-02T00:00:00Z"));
    expect(weekStart(date("2026-11-09T00:00:00Z"))).toEqual(date("2026-11-09T00:00:00Z"));
    expect(partitionName(date("2026-11-09T00:00:00Z"))).toBe("events_p20261109");
  });

  it("reads Postgres range bounds in any time zone", () => {
    expect(
      parsePartitionBound(
        "events_legacy",
        "FOR VALUES FROM (MINVALUE) TO ('2026-11-09 01:00:00+01')",
      ),
    ).toEqual({ name: "events_legacy", from: null, to: date("2026-11-09T00:00:00Z") });
    expect(
      parsePartitionBound(
        "events_p20261109",
        "FOR VALUES FROM ('2026-11-09 05:30:00+05:30') TO ('2026-11-16 00:00:00+00')",
      ),
    ).toEqual({
      name: "events_p20261109",
      from: date("2026-11-09T00:00:00Z"),
      to: date("2026-11-16T00:00:00Z"),
    });
    expect(parsePartitionBound("events_default", "DEFAULT")).toBeNull();
  });

  it("creates only the weeks no partition covers", () => {
    const partitions = [
      { name: "events_legacy", from: null, to: date("2026-11-09T00:00:00Z") },
      {
        name: "events_p20261109",
        from: date("2026-11-09T00:00:00Z"),
        to: date("2026-11-16T00:00:00Z"),
      },
    ];
    expect(missingWeeks(partitions, date("2026-11-04T10:00:00Z"))).toEqual([
      date("2026-11-16T00:00:00Z"),
      date("2026-11-23T00:00:00Z"),
      date("2026-11-30T00:00:00Z"),
    ]);
  });

  it("expires a partition only once its last instant is past the cutoff", () => {
    const partitions = [
      { name: "events_legacy", from: null, to: date("2026-11-09T00:00:00Z") },
      {
        name: "events_p20261109",
        from: date("2026-11-09T00:00:00Z"),
        to: date("2026-11-16T00:00:00Z"),
      },
    ];
    expect(expiredPartitions(partitions, date("2026-11-15T23:00:00Z"))).toEqual([partitions[0]]);
    expect(expiredPartitions(partitions, date("2026-11-08T23:00:00Z"))).toEqual([]);
  });
});
