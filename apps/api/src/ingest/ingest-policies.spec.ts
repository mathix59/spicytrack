import type { IngestProjectAccess, ParsedEventPayload } from "./ingest.types";
import {
  applyProjectPolicies,
  resolveIssueReopenState,
  resolveSuggestedAssignee,
} from "./ingest-policies";

const payload = (): ParsedEventPayload => ({
  sanitizedPayload: { request: { internalToken: "secret", safe: true } },
  groupingKey: "original",
  title: "Payment timeout",
  level: "error",
  message: "Timeout in src/payments/charge.ts",
  normalizedMessage: "timeout",
  eventExternalId: "event-1",
  timestamp: new Date(),
  environmentName: "production",
  releaseVersion: "1.0.0",
  culprit: "src/payments/charge.ts",
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

const project = (overrides: Partial<IngestProjectAccess> = {}): IngestProjectAccess => ({
  id: "project-1",
  organizationId: "org-1",
  projectKeyId: "key-1",
  keyRateLimitPerMinute: null,
  inboundRules: [],
  ownershipRules: [],
  piiScrubFields: [],
  ...overrides,
});

describe("ingest policies", () => {
  it("drops matching noise", () => {
    expect(
      applyProjectPolicies(
        project({ inboundRules: [{ action: "ignore", pattern: "payment timeout" }] }),
        payload(),
      ),
    ).toEqual({ ignored: true });
  });

  it("overrides grouping and recursively scrubs configured fields", () => {
    const event = payload();
    applyProjectPolicies(
      project({
        inboundRules: [{ action: "fingerprint", pattern: "timeout", fingerprint: "payments" }],
        piiScrubFields: ["internalToken"],
      }),
      event,
    );
    expect(event.groupingKey).toBe("custom:payments");
    expect(event.sanitizedPayload).toEqual({ request: { safe: true } });
  });

  it("routes to the first matching owner", () => {
    expect(
      resolveSuggestedAssignee([{ pattern: "src/payments/", assignedUserId: "user-1" }], payload()),
    ).toBe("user-1");
  });

  it("reopens a resolved issue only when it reappears in a new release", () => {
    expect(
      resolveIssueReopenState(
        { status: "resolved", releaseId: "release-1", ignoredUntil: null },
        { releaseId: "release-2", timestamp: new Date() },
      ),
    ).toEqual({ isRegression: true, shouldReopen: true });
    expect(
      resolveIssueReopenState(
        { status: "resolved", releaseId: "release-1", ignoredUntil: null },
        { releaseId: "release-1", timestamp: new Date() },
      ),
    ).toEqual({ isRegression: false, shouldReopen: false });
  });

  it("reopens an ignored issue after its snooze expires", () => {
    expect(
      resolveIssueReopenState(
        { status: "ignored", releaseId: null, ignoredUntil: new Date("2026-01-01T00:00:00Z") },
        { releaseId: null, timestamp: new Date("2026-01-02T00:00:00Z") },
      ),
    ).toEqual({ isRegression: false, shouldReopen: true });
  });
});
