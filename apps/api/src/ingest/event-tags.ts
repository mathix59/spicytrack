import { asString } from "../common/grouping";

const MAX_TAGS = 50;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 200;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tagValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim().slice(0, MAX_VALUE_LENGTH) || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function explicitTags(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is [string, unknown] => Array.isArray(entry) && typeof entry[0] === "string",
    );
  }
  return Object.entries(record(value));
}

/** "Chrome 120.0" from a Sentry context such as `{ name: "Chrome", version: "120.0" }`. */
function nameAndVersion(context: Record<string, unknown>) {
  const name = asString(context.name);
  const version = asString(context.version);
  return name && version ? `${name} ${version}` : name;
}

function withoutQuery(url: string | null) {
  return url?.split(/[?#]/, 1)[0] ?? null;
}

/**
 * Tags stored with an event: the SDK's own tags, as strings, plus tags derived from the payload
 * (user, browser, OS, runtime, environment, release…) so search and tag breakdowns can use them.
 * Explicit tags win over derived ones.
 */
export function buildEventTags(payload: Record<string, unknown>): Record<string, string> {
  const user = record(payload.user);
  const contexts = record(payload.contexts);
  const browser = record(contexts.browser);
  const os = record(contexts.os);
  const runtime = record(contexts.runtime);
  const device = record(contexts.device);
  const request = record(payload.request);

  const derived: [string, unknown][] = [
    ["level", payload.level ?? "error"],
    ["environment", payload.environment],
    ["release", payload.release],
    ["user.id", user.id],
    ["user.email", user.email],
    ["user.username", user.username],
    ["browser", nameAndVersion(browser)],
    ["browser.name", browser.name],
    ["os", nameAndVersion(os)],
    ["os.name", os.name],
    ["runtime", nameAndVersion(runtime)],
    ["runtime.name", runtime.name],
    ["device", device.model ?? device.family],
    ["server_name", payload.server_name],
    ["transaction", payload.transaction],
    ["url", withoutQuery(asString(request.url))],
  ];

  const tags: Record<string, string> = {};
  for (const [rawKey, rawValue] of [...derived, ...explicitTags(payload.tags)]) {
    const key = rawKey.trim().slice(0, MAX_KEY_LENGTH);
    const value = tagValue(rawValue);
    if (!key || value === null) continue;
    if (!(key in tags) && Object.keys(tags).length >= MAX_TAGS) continue;
    tags[key] = value;
  }

  return tags;
}
