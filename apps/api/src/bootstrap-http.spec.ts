import { gzipSync } from "node:zlib";
import { buildBetterAuthRequestUrl } from "./auth/auth-request-url";
import { decodeSentryBody } from "./ingest/sentry-body";

describe("buildBetterAuthRequestUrl", () => {
  const original = process.env.BETTER_AUTH_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = original;
  });

  it("uses the configured public origin instead of an untrusted Host header", () => {
    process.env.BETTER_AUTH_URL = "https://errors.example.com/api/better-auth";
    expect(buildBetterAuthRequestUrl("/api/better-auth/session").toString()).toBe(
      "https://errors.example.com/api/better-auth/session",
    );
  });
});

describe("decodeSentryBody", () => {
  const envelope = '{"event_id":"a"}\n{"type":"event"}\n{"message":"probe"}';

  it("decodes gzip-compressed Sentry envelopes", () => {
    expect(decodeSentryBody(gzipSync(envelope), "gzip", 1024)).toBe(envelope);
  });

  it("keeps uncompressed envelopes unchanged", () => {
    expect(decodeSentryBody(Buffer.from(envelope), undefined, 1024)).toBe(envelope);
  });

  it("rejects a decompressed envelope above the configured limit", () => {
    expect(() => decodeSentryBody(gzipSync("x".repeat(2048)), "gzip", 1024)).toThrow(
      "Invalid compressed request body",
    );
  });
});
