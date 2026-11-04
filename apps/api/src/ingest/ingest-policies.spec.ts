import type { IngestProjectAccess, ParsedEventPayload } from "./ingest.types";
import {
  applyProjectPolicies,
  resolveIssueReopenState,
  resolveSuggestedAssignee,
} from "./ingest-policies";

const payload = (): ParsedEventPayload => ({
  sanitizedPayload: { request: { internalToken: "secret", safe: true } },
  groupingKey: "original",
  legacyGroupingKey: "legacy",
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
  hasActiveAlertRules: false,
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

  it("reopens an issue resolved now on its next event", () => {
    expect(
      resolveIssueReopenState(
        { status: "resolved", releaseId: "release-1", ignoredUntil: null },
        { releaseId: "release-1", timestamp: new Date() },
      ),
    ).toEqual({ isRegression: true, shouldReopen: true });
    expect(
      resolveIssueReopenState(
        { status: "resolved", releaseId: null, ignoredUntil: null },
        { releaseId: null, timestamp: new Date() },
      ),
    ).toEqual({ isRegression: true, shouldReopen: true });
  });

  it("reopens an issue resolved in the next release only from a newer release", () => {
    const issue = {
      status: "resolved",
      releaseId: "release-1",
      ignoredUntil: null,
      resolvedAt: new Date("2026-11-01T00:00:00Z"),
      resolvedInReleaseId: "release-1",
    };
    const reopen = (releaseId: string | null, releaseCreatedAt: string | null) =>
      resolveIssueReopenState(issue, {
        releaseId,
        timestamp: new Date("2026-11-03T00:00:00Z"),
        releaseCreatedAt: releaseCreatedAt ? new Date(releaseCreatedAt) : null,
      }).shouldReopen;

    expect(reopen("release-1", null)).toBe(false);
    expect(reopen(null, null)).toBe(false);
    expect(reopen("release-0", "2026-10-20T00:00:00Z")).toBe(false);
    expect(reopen("release-2", "2026-11-02T00:00:00Z")).toBe(true);
  });

  it("reopens an ignored issue in a new release as a regression", () => {
    expect(
      resolveIssueReopenState(
        { status: "ignored", releaseId: "release-1", ignoredUntil: null },
        { releaseId: "release-2", timestamp: new Date() },
      ),
    ).toEqual({ isRegression: true, shouldReopen: true });
    expect(
      resolveIssueReopenState(
        { status: "ignored", releaseId: "release-1", ignoredUntil: null },
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
