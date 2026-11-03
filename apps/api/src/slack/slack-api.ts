import { createHmac, timingSafeEqual } from "node:crypto";

/** Slack refuses requests signed more than five minutes ago, and so do we. */
export const SLACK_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const REQUEST_TIMEOUT_MS = 5000;

export const slackApiUrl = () =>
  (process.env.SLACK_API_URL ?? "https://slack.com/api").replace(/\/+$/, "");

export class SlackApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Calls a Slack Web API method with a bot token. Slack reports errors as `ok: false`. */
export async function callSlack<T extends Record<string, unknown>>(
  token: string,
  method: string,
  params: Record<string, string> = {},
): Promise<{ body: T; scopes: string[] }> {
  let response: Response;
  try {
    response = await fetch(`${slackApiUrl()}/${method}`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });
  } catch (error) {
    throw new SlackApiError(
      "unreachable",
      `Slack could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const body = (await response.json().catch(() => null)) as
    | (T & { ok?: boolean; error?: string })
    | null;
  if (!response.ok || !body?.ok) {
    const code = body?.error ?? `http_${response.status}`;
    throw new SlackApiError(code, `Slack ${method} failed: ${code}`);
  }
  const scopes = (response.headers.get("x-oauth-scopes") ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return { body, scopes };
}

/** Checks Slack's `v0` request signature: HMAC-SHA256 of `v0:<timestamp>:<raw body>`. */
export function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  now?: number;
}): boolean {
  const { timestamp, signature } = input;
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  const now = input.now ?? Date.now() / 1000;
  if (Math.abs(now - Number(timestamp)) > SLACK_SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = `v0=${createHmac("sha256", input.signingSecret)
    .update(`v0:${timestamp}:${input.rawBody}`)
    .digest("hex")}`;
  const received = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

/** Response URLs come from Slack; only Slack's own hosts are posted to. */
export function isSlackResponseUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (process.env.SLACK_API_URL) {
      return url.origin === new URL(process.env.SLACK_API_URL).origin;
    }
    return url.protocol === "https:" && url.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

export async function postToResponseUrl(url: string, body: Record<string, unknown>) {
  if (!isSlackResponseUrl(url)) throw new SlackApiError("invalid_response_url", "Not a Slack URL");
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new SlackApiError(
      `http_${response.status}`,
      `Slack response URL returned ${response.status}`,
    );
  }
}
