import {
  asString,
  computeGroupingKey,
  computeIssueTitle,
  createExternalEventId,
  normalizeMessage,
} from "../common/grouping";
import { redactEventPayload } from "../common/event-payload-redaction";

import type { ParsedEventPayload } from "./ingest.types";

function parseEnvelopeEvent(envelope: string) {
  const lines = envelope.split("\n");

  for (let index = 1; index < lines.length; index += 1) {
    const headerLine = lines[index];
    if (!headerLine) {
      continue;
    }

    let itemHeader: Record<string, unknown>;
    try {
      itemHeader = JSON.parse(headerLine) as Record<string, unknown>;
    } catch {
      continue;
    }

    const payloadLine = lines[index + 1];
    if (itemHeader.type === "event" && payloadLine) {
      return JSON.parse(payloadLine) as Record<string, unknown>;
    }
  }

  return null;
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

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string",
        )
        .map(([key, tagValue]) => [key, tagValue]),
    );
  }

  return normalizeRecord(value);
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
    groupingKey: computeGroupingKey(sanitizedPayload),
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
    tags: normalizeTags(sanitizedPayload.tags),
    contexts: normalizeRecord(sanitizedPayload.contexts),
    extra: normalizeRecord(sanitizedPayload.extra),
  };
}

export { parseEnvelopeEvent, parseEventPayload };
