import {
  SESSION_OUTCOME,
  hourStart,
  normalizeSessionAggregates,
  normalizeSessionUpdate,
} from "./session-updates";

const now = new Date("2026-11-04T12:30:00Z");
const attrs = { release: "web@1.2.0", environment: "production" };

describe("normalizeSessionUpdate", () => {
  it("reads a session update", () => {
    expect(
      normalizeSessionUpdate(
        {
          sid: "7c5d0e46b6c94a7c",
          did: "user-1",
          init: true,
          started: "2026-11-04T12:10:00Z",
          status: "ok",
          errors: 0,
          attrs,
        },
        now,
      ),
    ).toEqual({
      sessionId: "7c5d0e46b6c94a7c",
      distinctId: "user-1",
      releaseVersion: "web@1.2.0",
      environment: "production",
      startedAt: new Date("2026-11-04T12:10:00Z"),
      outcome: SESSION_OUTCOME.healthy,
    });
  });

  it.each([
    ["crashed", 0, SESSION_OUTCOME.crashed],
    ["abnormal", 0, SESSION_OUTCOME.abnormal],
    ["errored", 0, SESSION_OUTCOME.errored],
    ["ok", 2, SESSION_OUTCOME.errored],
    ["exited", 1, SESSION_OUTCOME.errored],
    ["exited", 0, SESSION_OUTCOME.healthy],
  ])("maps status %s with %d errors", (status, errors, outcome) => {
    expect(
      normalizeSessionUpdate({ sid: "s", started: now.toISOString(), status, errors, attrs }, now)
        ?.outcome,
    ).toBe(outcome);
  });

  it("drops sessions without a release, a session id, or a recent start", () => {
    const started = now.toISOString();
    expect(normalizeSessionUpdate({ sid: "s", started, attrs: {} }, now)).toBeNull();
    expect(normalizeSessionUpdate({ started, attrs }, now)).toBeNull();
    expect(normalizeSessionUpdate({ sid: "s", started: "yesterday-ish", attrs }, now)).toBeNull();
    expect(
      normalizeSessionUpdate({ sid: "s", started: "2026-10-20T00:00:00Z", attrs }, now),
    ).toBeNull();
  });

  it("clamps a start in the future and defaults the environment", () => {
    const update = normalizeSessionUpdate(
      { sid: "s", started: "2027-01-01T00:00:00Z", attrs: { release: "1.0" } },
      now,
    );
    expect(update).toMatchObject({ startedAt: now, environment: "", distinctId: null });
  });
});

describe("normalizeSessionAggregates", () => {
  it("sums each group and skips empty or invalid ones", () => {
    expect(
      normalizeSessionAggregates(
        {
          attrs,
          aggregates: [
            { started: "2026-11-04T12:00:00Z", exited: 10, errored: 2, abnormal: 1, crashed: 1 },
            { started: "2026-11-04T12:01:00Z", exited: 0 },
            { started: "2026-11-04T12:02:00Z", exited: -4, crashed: 1.5 },
            "nope",
            { started: "2026-11-04T12:03:00Z", exited: 1, did: "user-9" },
          ],
        },
        now,
      ),
    ).toEqual([
      {
        releaseVersion: "web@1.2.0",
        environment: "production",
        startedAt: new Date("2026-11-04T12:00:00Z"),
        distinctId: null,
        sessions: 14,
        errored: 2,
        abnormal: 1,
        crashed: 1,
      },
      expect.objectContaining({ sessions: 1, distinctId: "user-9" }),
    ]);
  });

  it("requires a release", () => {
    expect(
      normalizeSessionAggregates({ aggregates: [{ started: now.toISOString(), exited: 1 }] }, now),
    ).toEqual([]);
  });
});

it("floors to the hour", () => {
  expect(hourStart(now)).toEqual(new Date("2026-11-04T12:00:00Z"));
});
