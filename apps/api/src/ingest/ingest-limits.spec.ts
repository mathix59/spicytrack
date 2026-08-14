import { ingestLimits } from "./ingest-limits";

describe("ingestLimits", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("uses safe payload and hourly quota defaults", () => {
    delete process.env.INGEST_MAX_EVENT_BYTES;
    delete process.env.INGEST_PROJECT_EVENTS_PER_HOUR;
    delete process.env.INGEST_ORGANIZATION_EVENTS_PER_HOUR;
    expect(ingestLimits()).toEqual({
      maxEventBytes: 1_000_000,
      projectEventsPerHour: 10_000,
      organizationEventsPerHour: 50_000,
    });
  });

  it("validates configured limits", () => {
    process.env.INGEST_MAX_EVENT_BYTES = "250000";
    process.env.INGEST_PROJECT_EVENTS_PER_HOUR = "1000";
    process.env.INGEST_ORGANIZATION_EVENTS_PER_HOUR = "5000";
    expect(ingestLimits()).toEqual({
      maxEventBytes: 250_000,
      projectEventsPerHour: 1_000,
      organizationEventsPerHour: 5_000,
    });
    process.env.INGEST_MAX_EVENT_BYTES = "invalid";
    expect(() => ingestLimits()).toThrow("INGEST_MAX_EVENT_BYTES");
  });
});
