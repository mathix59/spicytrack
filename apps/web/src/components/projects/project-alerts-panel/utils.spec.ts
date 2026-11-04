import { describe, expect, it } from "vitest";

import type { AlertRuleDto } from "@/generated/api";

import { deliveryTitle, destinationLabel, ruleTriggerTypes, triggerLabel } from "./utils";

describe("triggerLabel", () => {
  it("describes thresholds with their window", () => {
    expect(triggerLabel("event_threshold", 100)).toBe("100 events / 1h");
    expect(triggerLabel("event_threshold", 5, 15)).toBe("5 events / 15 min");
    expect(triggerLabel("event_threshold", 50, 2880)).toBe("50 events / 2d");
    expect(triggerLabel("event_threshold", null)).toBe("Threshold n/a");
  });

  it("names the other triggers", () => {
    expect(triggerLabel("regression", null)).toBe("Regression");
    expect(triggerLabel("daily_digest", null)).toBe("Daily digest");
    expect(triggerLabel("new_issue", null)).toBe("New issue");
  });
});

describe("ruleTriggerTypes", () => {
  it("prefers the trigger list and drops unknown values", () => {
    const rule = { triggerTypes: ["regression", "bogus"], triggerType: "new_issue" };
    expect(ruleTriggerTypes(rule as unknown as AlertRuleDto)).toEqual(["regression"]);
  });

  it("falls back to the single trigger, then to new issues", () => {
    expect(ruleTriggerTypes({ triggerType: "daily_digest" } as unknown as AlertRuleDto)).toEqual([
      "daily_digest",
    ]);
    expect(ruleTriggerTypes({ triggerTypes: [] } as unknown as AlertRuleDto)).toEqual([
      "new_issue",
    ]);
  });
});

describe("deliveryTitle", () => {
  it("prefixes the issue title with its project", () => {
    expect(deliveryTitle({ issueTitle: "TypeError", projectSlug: "web" })).toBe("web · TypeError");
    expect(deliveryTitle({ issueTitle: "TypeError" })).toBe("TypeError");
    expect(deliveryTitle(null)).toBe("Alert delivery");
    expect(deliveryTitle({ projectSlug: "web" })).toBe("Alert delivery");
  });
});

describe("destinationLabel", () => {
  it("labels known destinations and passes unknown ones through", () => {
    expect(destinationLabel("teams")).toBe("Microsoft Teams");
    expect(destinationLabel("carrier-pigeon")).toBe("carrier-pigeon");
  });
});
