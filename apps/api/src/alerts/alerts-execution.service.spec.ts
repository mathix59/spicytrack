import { BadRequestException } from "@nestjs/common";
import { AlertsDeliveryService } from "./alerts-delivery.service";
import { resolveDestinationUpdate } from "./alerts.controller";
import { matchingTriggerTypes, shouldTriggerAlertRule } from "./alerts-execution.service";
import { maskDestinationTarget } from "./alerts.service";
import type { EmailService } from "../email/email.service";

describe("alert trigger matching", () => {
  it("matches every configured trigger satisfied by the same event", () => {
    const rule = {
      triggerTypes: ["new_issue", "regression", "event_threshold", "daily_digest"],
      threshold: 5,
    };

    expect(
      matchingTriggerTypes(rule, {
        issueWasCreated: true,
        issueRegressed: true,
        recentEventCount: 5,
      }),
    ).toEqual(["new_issue", "regression", "event_threshold"]);
  });

  it("counts the threshold within the window, not over the issue's lifetime", () => {
    const rule = { triggerTypes: ["event_threshold"], threshold: 10 };

    expect(
      shouldTriggerAlertRule(rule, {
        issueWasCreated: false,
        issueRegressed: false,
        recentEventCount: 9,
      }),
    ).toBe(false);
    expect(
      shouldTriggerAlertRule(rule, {
        issueWasCreated: false,
        issueRegressed: false,
        recentEventCount: 10,
      }),
    ).toBe(true);
  });
});

describe("alert destinations", () => {
  it("masks secret URLs but keeps email addresses readable", () => {
    expect(
      maskDestinationTarget("slack", "https://hooks.slack.com/services/T000/B000/XXXXsecretABCD"),
    ).toBe("https://hooks.slack.com/…ABCD");
    expect(maskDestinationTarget("webhook", "https://example.com/hook?token=abc123")).toBe(
      "https://example.com/…c123",
    );
    expect(maskDestinationTarget("email", "ops@example.com")).toBe("ops@example.com");
  });

  it("validates the target against the type the rule will have", () => {
    expect(resolveDestinationUpdate("webhook", "email", "ops@example.com")).toEqual({
      destinationType: "email",
      destinationTarget: "ops@example.com",
    });
    expect(() => resolveDestinationUpdate("email", undefined, "not-an-email")).toThrow(
      BadRequestException,
    );
    expect(() => resolveDestinationUpdate("webhook", "email", undefined)).toThrow(
      "destinationTarget is required when changing destinationType",
    );
    expect(resolveDestinationUpdate("slack", undefined, undefined)).toEqual({
      destinationType: "slack",
    });
  });
});

describe("alert delivery", () => {
  const rule = { destinationType: "email", destinationTarget: "ops@example.com" } as never;
  const payload = {
    triggerType: "new_issue",
    projectId: "project-id",
    projectName: "Checkout UI",
    issueTitle: "TypeError: boom",
    issueUrl: "https://app.example.com/orgs/acme/projects/checkout/issues/issue-id",
    timesSeen: 3,
  };

  it("writes an English message with the project name and a link to the issue", () => {
    const service = new AlertsDeliveryService({} as EmailService);

    expect(service.buildMessage(payload)).toBe(
      [
        "[SpicyTrack] New issue: TypeError: boom",
        "Project: Checkout UI · seen 3 times",
        "https://app.example.com/orgs/acme/projects/checkout/issues/issue-id",
      ].join("\n"),
    );
  });

  it("reports an email that was only logged as a failed delivery", async () => {
    const service = new AlertsDeliveryService({
      send: jest.fn().mockResolvedValue("logged"),
    } as unknown as EmailService);

    await expect(service.deliverToDestination(rule, payload)).resolves.toMatchObject({
      status: "failed",
      responseBody: expect.stringContaining("SMTP is not configured"),
    });
  });

  it("reports a sent email as a success", async () => {
    const service = new AlertsDeliveryService({
      send: jest.fn().mockResolvedValue("sent"),
    } as unknown as EmailService);

    await expect(service.deliverToDestination(rule, payload)).resolves.toMatchObject({
      status: "success",
    });
  });
});
