import {
  asString,
  computeGroupingKeys,
  computeIssueTitle,
  createExternalEventId,
  normalizeMessage,
} from "../common/grouping";
import { redactEventPayload } from "../common/event-payload-redaction";
import { buildEventTags } from "./event-tags";

import type { ParsedEventPayload } from "./ingest.types";

export class InvalidEnvelopeError extends Error {}

type ParsedEnvelope = {
  event: Record<string, unknown> | null;
  /** `session` item payloads (one SDK session update each). */
  sessions: Record<string, unknown>[];
  /** `sessions` item payloads (pre-aggregated counts from server SDKs). */
  sessionAggregates: Record<string, unknown>[];
};

function parseObject(text: string) {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Splits an envelope into the items SpicyTrack stores: its first event, and its session
 * updates. Items with a `length` header are read by length, the others up to the next newline.
 * Throws InvalidEnvelopeError when the event item is not a JSON object; malformed session
 * items are skipped.
 */
function parseEnvelope(envelope: string): ParsedEnvelope {
  const parsed: ParsedEnvelope = { event: null, sessions: [], sessionAggregates: [] };
  const buffer = Buffer.from(envelope, "utf8");
  const lineEnd = (from: number) => {
    const index = buffer.indexOf(0x0a, from);
    return index === -1 ? buffer.length : index;
  };

  let offset = lineEnd(0) + 1;
  while (offset < buffer.length) {
    const headerEnd = lineEnd(offset);
    const itemHeader = parseObject(buffer.toString("utf8", offset, headerEnd));
    offset = headerEnd + 1;
    if (!itemHeader) continue;

    const length = itemHeader.length;
    const payloadEnd =
      typeof length === "number" && Number.isSafeInteger(length) && length >= 0
        ? Math.min(offset + length, buffer.length)
        : lineEnd(offset);
    const payloadText = buffer.toString("utf8", offset, payloadEnd);
    offset = payloadEnd + 1;

    if (itemHeader.type === "event") {
      if (parsed.event) continue;
      let event: unknown;
      try {
        event = JSON.parse(payloadText);
      } catch {
        throw new InvalidEnvelopeError("The envelope's event item is not valid JSON");
      }
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw new InvalidEnvelopeError("The envelope's event item must be a JSON object");
      }
      parsed.event = event as Record<string, unknown>;
    } else if (itemHeader.type === "session" || itemHeader.type === "sessions") {
      const item = parseObject(payloadText);
      if (item) {
        (itemHeader.type === "session" ? parsed.sessions : parsed.sessionAggregates).push(item);
      }
    }
  }

  return parsed;
}

/** Returns the envelope's event item, or null when it carries none (sessions, transactions…). */
function parseEnvelopeEvent(envelope: string) {
  return parseEnvelope(envelope).event;
}

function parseTimestamp(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (Number.isFinite(numericValue)) {
    const milliseconds =
      Math.abs(numericValue) < 100_000_000_000 ? numericValue * 1_000 : numericValue;
    const timestamp = new Date(milliseconds);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }

  if (typeof value === "string") {
    const timestamp = new Date(value);
    if (!Number.isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }

  return new Date();
}

function normalizeRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getNestedString(value: unknown, path: string[]) {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : null;
}

function getUserIdentifier(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return asString(record.id) ?? asString(record.email) ?? asString(record.username) ?? null;
}

function parseEventPayload(payload: Record<string, unknown>): ParsedEventPayload {
  const sanitizedPayload = redactEventPayload(payload);
  const message = asString(sanitizedPayload.message);

  return {
    sanitizedPayload,
    ...computeGroupingKeys(sanitizedPayload),
    title: computeIssueTitle(sanitizedPayload),
    level: asString(sanitizedPayload.level) ?? "error",
    message,
    normalizedMessage: normalizeMessage(message),
    eventExternalId: asString(sanitizedPayload.event_id) ?? createExternalEventId(),
    timestamp: parseTimestamp(sanitizedPayload.timestamp),
    environmentName: asString(sanitizedPayload.environment)?.trim() || null,
    releaseVersion: asString(sanitizedPayload.release)?.trim() || null,
    culprit: asString(sanitizedPayload.transaction) ?? null,
    platform: asString(sanitizedPayload.platform) ?? "javascript",
    logger: asString(sanitizedPayload.logger),
    transactionName: asString(sanitizedPayload.transaction),
    serverName: asString(sanitizedPayload.server_name),
    sdkName: getNestedString(sanitizedPayload, ["sdk", "name"]),
    sdkVersion: getNestedString(sanitizedPayload, ["sdk", "version"]),
    dist: asString(sanitizedPayload.dist),
    userIdentifier: getUserIdentifier(sanitizedPayload.user),
    requestMethod: getNestedString(sanitizedPayload, ["request", "method"]),
    requestUrl: getNestedString(sanitizedPayload, ["request", "url"]),
    fingerprintOverride: Array.isArray(sanitizedPayload.fingerprint)
      ? sanitizedPayload.fingerprint
      : null,
    tags: buildEventTags(sanitizedPayload),
    contexts: normalizeRecord(sanitizedPayload.contexts),
    extra: normalizeRecord(sanitizedPayload.extra),
  };
}

export { parseEnvelope, parseEnvelopeEvent, parseEventPayload };
export type { ParsedEnvelope };
