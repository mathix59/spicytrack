import { createHmac } from "node:crypto";
import { callSlack, isSlackResponseUrl, verifySlackSignature } from "./slack-api";

describe("Slack API helpers", () => {
  const secret = "8f742231b10e8888abcd99yyyzzz85a5";
  const rawBody = "payload=%7B%22type%22%3A%22block_actions%22%7D";
  const sign = (timestamp: string, body = rawBody, key = secret) =>
    `v0=${createHmac("sha256", key).update(`v0:${timestamp}:${body}`).digest("hex")}`;

  afterEach(() => {
    delete process.env.SLACK_API_URL;
  });

  describe("verifySlackSignature", () => {
    const now = 1_700_000_000;
    const timestamp = String(now - 10);

    it("accepts a fresh request signed with the secret", () => {
      expect(
        verifySlackSignature({
          signingSecret: secret,
          timestamp,
          signature: sign(timestamp),
          rawBody,
          now,
        }),
      ).toBe(true);
    });

    it("rejects another secret, a changed body, missing headers and stale requests", () => {
      const check = (input: Partial<Parameters<typeof verifySlackSignature>[0]>) =>
        verifySlackSignature({
          signingSecret: secret,
          timestamp,
          signature: sign(timestamp),
          rawBody,
          now,
          ...input,
        });
      expect(check({ signature: sign(timestamp, rawBody, "other") })).toBe(false);
      expect(check({ rawBody: `${rawBody}&x=1` })).toBe(false);
      expect(check({ signature: undefined })).toBe(false);
      expect(check({ timestamp: undefined })).toBe(false);
      expect(check({ signature: "v0=short" })).toBe(false);
      const old = String(now - 301);
      expect(check({ timestamp: old, signature: sign(old) })).toBe(false);
    });
  });

  it("only posts to Slack's own response hosts", () => {
    expect(isSlackResponseUrl("https://hooks.slack.com/actions/T1/1/abc")).toBe(true);
    expect(isSlackResponseUrl("http://hooks.slack.com/actions/T1/1/abc")).toBe(false);
    expect(isSlackResponseUrl("https://hooks.slack.com.evil.test/x")).toBe(false);
    expect(isSlackResponseUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isSlackResponseUrl(undefined)).toBe(false);
    process.env.SLACK_API_URL = "http://127.0.0.1:4701";
    expect(isSlackResponseUrl("http://127.0.0.1:4701/respond/1")).toBe(true);
    expect(isSlackResponseUrl("https://hooks.slack.com/actions/T1/1/abc")).toBe(false);
  });

  describe("callSlack", () => {
    const fetchMock = jest.fn();
    beforeEach(() => {
      fetchMock.mockReset();
      global.fetch = fetchMock as unknown as typeof fetch;
    });

    it("sends a form with the bot token and returns the granted scopes", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ ok: true, team_id: "T1" }), {
          headers: { "x-oauth-scopes": "incoming-webhook, users:read" },
        }),
      );
      await expect(callSlack("xoxb-1", "users.info", { user: "U1" })).resolves.toEqual({
        body: { ok: true, team_id: "T1" },
        scopes: ["incoming-webhook", "users:read"],
      });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://slack.com/api/users.info");
      expect(init.body).toBe("user=U1");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer xoxb-1");
      expect(init.redirect).toBe("error");
    });

    it("turns ok:false and network failures into coded errors", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, error: "invalid_auth" })),
      );
      await expect(callSlack("xoxb-1", "auth.test")).rejects.toMatchObject({
        code: "invalid_auth",
      });
      fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
      await expect(callSlack("xoxb-1", "auth.test")).rejects.toMatchObject({
        code: "unreachable",
      });
    });
  });
});
