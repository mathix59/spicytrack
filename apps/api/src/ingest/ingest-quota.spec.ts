import { IngestQuotaExceededException } from "./ingest.service";

describe("IngestQuotaExceededException", () => {
  it("tells SDKs when and for which scope to back off", () => {
    const error = new IngestQuotaExceededException("organization_hour", 1_234);

    expect(error.getStatus()).toBe(429);
    expect(error.headers).toEqual({
      "Retry-After": "1234",
      "X-Sentry-Rate-Limits": "1234::organization:quota_exceeded",
    });
    expect(new IngestQuotaExceededException("project_key_minute", 7).headers).toMatchObject({
      "X-Sentry-Rate-Limits": "7::key:quota_exceeded",
    });
  });
});
