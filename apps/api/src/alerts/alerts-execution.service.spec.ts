import { matchingTriggerTypes, shouldTriggerAlertRule } from "./alerts-execution.service";

const now = new Date("2026-08-14T12:00:00Z");

describe("alert trigger matching", () => {
  it("matches every configured trigger satisfied by the same event", () => {
    const rule = {
      triggerTypes: ["new_issue", "regression", "event_threshold", "daily_digest"],
      threshold: 5,
      cooldownMinutes: 30,
      lastTriggeredAt: null,
    };

    expect(
      matchingTriggerTypes(
        rule,
        { issueWasCreated: true, issueRegressed: true, timesSeen: 5 },
        now,
      ),
    ).toEqual(["new_issue", "regression", "event_threshold"]);
    expect(
      shouldTriggerAlertRule(
        rule,
        { issueWasCreated: true, issueRegressed: true, timesSeen: 5 },
        now,
      ),
    ).toBe(true);
  });

  it("does not match event triggers while the shared rule cooldown is active", () => {
    expect(
      matchingTriggerTypes(
        {
          triggerTypes: ["new_issue", "regression"],
          threshold: null,
          cooldownMinutes: 30,
          lastTriggeredAt: new Date("2026-08-14T11:45:00Z"),
        },
        { issueWasCreated: true, issueRegressed: true, timesSeen: 1 },
        now,
      ),
    ).toEqual([]);
  });

  it("requires the configured threshold to be reached", () => {
    const rule = {
      triggerTypes: ["event_threshold"],
      threshold: 10,
      cooldownMinutes: 30,
      lastTriggeredAt: null,
    };

    expect(
      shouldTriggerAlertRule(
        rule,
        { issueWasCreated: false, issueRegressed: false, timesSeen: 9 },
        now,
      ),
    ).toBe(false);
  });
});
