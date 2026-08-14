import { nextDailyDigestAt } from "./daily-digest-job.handler";

describe("daily digest scheduling", () => {
  it("schedules the same day before 08:00 UTC", () => {
    expect(nextDailyDigestAt(new Date("2026-08-09T07:00:00Z")).toISOString()).toBe(
      "2026-08-09T08:00:00.000Z",
    );
  });

  it("schedules the next day after 08:00 UTC", () => {
    expect(nextDailyDigestAt(new Date("2026-08-09T09:00:00Z")).toISOString()).toBe(
      "2026-08-10T08:00:00.000Z",
    );
  });
});
