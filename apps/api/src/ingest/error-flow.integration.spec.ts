import { shouldTriggerAlertRule } from "../alerts/alerts-execution.service";
import type { IngestProjectAccess, ParsedEventPayload } from "./ingest.types";
import { applyProjectPolicies, resolveIssueReopenState } from "./ingest-policies";

const project: IngestProjectAccess = {
  id: "project-1",
  organizationId: "org-1",
  projectKeyId: "key-1",
  keyRateLimitPerMinute: null,
  inboundRules: [{ action: "fingerprint", pattern: "database timeout", fingerprint: "database" }],
  ownershipRules: [],
  piiScrubFields: [],
};

const event = (): ParsedEventPayload => ({
  sanitizedPayload: {},
  groupingKey: "original",
  title: "Database timeout",
  level: "error",
  message: "Database timeout",
  normalizedMessage: "database timeout",
  eventExternalId: "event-1",
  timestamp: new Date("2026-08-09T10:00:00Z"),
  environmentName: "production",
  releaseVersion: "2.0.0",
  culprit: "database",
  platform: "node",
  logger: null,
  transactionName: null,
  serverName: null,
  sdkName: null,
  sdkVersion: null,
  dist: null,
  userIdentifier: null,
  requestMethod: null,
  requestUrl: null,
  fingerprintOverride: null,
  tags: {},
  contexts: {},
  extra: {},
});

describe("error ingestion to alert flow", () => {
  it("groups a matching event, reopens a resolved issue and triggers a regression alert", () => {
    const payload = event();
    expect(applyProjectPolicies(project, payload)).toEqual({ ignored: false });
    expect(payload.groupingKey).toBe("custom:database");

    const reopen = resolveIssueReopenState(
      { status: "resolved", releaseId: "release-1", ignoredUntil: null },
      { releaseId: "release-2", timestamp: payload.timestamp },
    );
    expect(reopen).toEqual({ isRegression: true, shouldReopen: true });
    expect(
      shouldTriggerAlertRule(
        {
          triggerTypes: ["new_issue", "regression"],
          threshold: null,
          cooldownMinutes: 30,
          lastTriggeredAt: null,
        },
        { issueWasCreated: false, issueRegressed: reopen.isRegression, timesSeen: 4 },
        payload.timestamp,
      ),
    ).toBe(true);
  });
});
