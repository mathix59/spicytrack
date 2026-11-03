import type { DatabaseClient } from "../database/database.provider";
import type { IngestService } from "../ingest/ingest.service";
import { buildTestEvent, TEST_EVENT_SDK_NAME } from "../ingest/test-event";
import { parseWait } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

function databaseReturning(...rows: Array<{ firstEventAt: Date | null }>) {
  const limit = jest.fn();
  for (const row of rows) limit.mockResolvedValueOnce([{ ...row, lastEventAt: row.firstEventAt }]);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { database: { select } as unknown as DatabaseClient, limit };
}

describe("buildTestEvent", () => {
  it("groups every test event into one issue and marks it as a test", () => {
    const now = new Date("2026-11-03T10:00:00Z");
    const first = buildTestEvent({ platform: "python", sentBy: "a@example.com", now });
    const second = buildTestEvent({ platform: "python", sentBy: "a@example.com", now });

    expect(first.fingerprint).toEqual(["spicytrack-test-event"]);
    expect(first.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(first.event_id).not.toBe(second.event_id);
    expect(first.timestamp).toBe(now.getTime() / 1000);
    expect(first.platform).toBe("python");
    expect(first.tags).toEqual({ test_event: "true" });
    expect(first.sdk.name).toBe(TEST_EVENT_SDK_NAME);
    expect(first.exception.values[0]?.type).toBe("SpicyTrackTestError");
  });
});

describe("parseWait", () => {
  it("defaults to an immediate answer", () => {
    expect(parseWait(undefined)).toBe(0);
    expect(parseWait("")).toBe(0);
    expect(parseWait("25")).toBe(25);
  });

  it.each(["-1", "26", "1.5", "soon"])("rejects %s", (value) => {
    expect(() => parseWait(value)).toThrow("wait must be between 0 and 25");
  });
});

describe("OnboardingService.waitForFirstEvent", () => {
  afterEach(() => jest.useRealTimers());

  it("answers at once when the project already has its first event", async () => {
    const firstEventAt = new Date("2026-11-03T10:00:00Z");
    const { database, limit } = databaseReturning({ firstEventAt });
    const service = new OnboardingService(database, {} as IngestService);

    await expect(service.waitForFirstEvent("project", 25, () => false)).resolves.toEqual({
      firstEventAt,
      lastEventAt: firstEventAt,
    });
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it("keeps checking until the first event arrives", async () => {
    jest.useFakeTimers();
    const firstEventAt = new Date("2026-11-03T10:00:02Z");
    const { database, limit } = databaseReturning(
      { firstEventAt: null },
      { firstEventAt: null },
      { firstEventAt },
    );
    const service = new OnboardingService(database, {} as IngestService);

    const result = service.waitForFirstEvent("project", 25, () => false);
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toMatchObject({ firstEventAt });
    expect(limit).toHaveBeenCalledTimes(3);
  });

  it("stops waiting once the client disconnects", async () => {
    const { database, limit } = databaseReturning({ firstEventAt: null });
    const service = new OnboardingService(database, {} as IngestService);

    await expect(service.waitForFirstEvent("project", 25, () => true)).resolves.toEqual({
      firstEventAt: null,
      lastEventAt: null,
    });
    expect(limit).toHaveBeenCalledTimes(1);
  });
});

describe("OnboardingService.sendTestEvent", () => {
  it("reports a dropped test event with its reason", async () => {
    const ingestTestEvent = jest.fn().mockResolvedValue({ dropped: true, reason: "rate_limited" });
    const { database } = databaseReturning();
    const service = new OnboardingService(database, {
      ingestTestEvent,
    } as unknown as IngestService);

    await expect(
      service.sendTestEvent({ id: "project", platform: "node" }, "a@example.com"),
    ).resolves.toEqual({ stored: false, issueId: null, eventId: null, reason: "rate_limited" });
    expect(ingestTestEvent).toHaveBeenCalledWith(
      "project",
      expect.objectContaining({ platform: "node", extra: { sentBy: "a@example.com" } }),
    );
  });
});
