import type { IngestProjectAccess, ParsedEventPayload } from "./ingest.types";

function policySearchText(payload: ParsedEventPayload) {
  return [payload.title, payload.message, payload.culprit, JSON.stringify(payload.sanitizedPayload)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function scrubFields(value: unknown, fields: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((entry) => scrubFields(entry, fields));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !fields.has(key.toLowerCase()))
      .map(([key, entry]) => [key, scrubFields(entry, fields)]),
  );
}

export function applyProjectPolicies(project: IngestProjectAccess, payload: ParsedEventPayload) {
  const searchable = policySearchText(payload);
  const rules = Array.isArray(project.inboundRules) ? project.inboundRules : [];
  for (const entry of rules) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rule = entry as Record<string, unknown>;
    const pattern = typeof rule.pattern === "string" ? rule.pattern.trim().toLowerCase() : "";
    if (!pattern || !searchable.includes(pattern)) continue;
    if (rule.action === "ignore") return { ignored: true };
    if (rule.action === "fingerprint" && typeof rule.fingerprint === "string") {
      payload.groupingKey = `custom:${rule.fingerprint.trim()}`;
    }
  }

  const fields = new Set(
    (Array.isArray(project.piiScrubFields) ? project.piiScrubFields : [])
      .filter((field): field is string => typeof field === "string")
      .map((field) => field.toLowerCase()),
  );
  if (fields.size > 0) {
    payload.sanitizedPayload = scrubFields(payload.sanitizedPayload, fields) as Record<
      string,
      unknown
    >;
  }
  return { ignored: false };
}

export function resolveSuggestedAssignee(rulesValue: unknown, payload: ParsedEventPayload) {
  const searchable = policySearchText(payload);
  const rules = Array.isArray(rulesValue) ? rulesValue : [];
  for (const entry of rules) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rule = entry as Record<string, unknown>;
    const pattern = typeof rule.pattern === "string" ? rule.pattern.trim().toLowerCase() : "";
    if (pattern && searchable.includes(pattern) && typeof rule.assignedUserId === "string") {
      return rule.assignedUserId;
    }
  }
  return null;
}

export function resolveIssueReopenState(
  issue: {
    status: string;
    releaseId: string | null;
    ignoredUntil: Date | null;
  },
  next: { releaseId: string | null; timestamp: Date },
) {
  const wasClosed = issue.status === "resolved" || issue.status === "ignored";
  const appearedInNewRelease =
    Boolean(next.releaseId) && Boolean(issue.releaseId) && next.releaseId !== issue.releaseId;
  const isRegression = wasClosed && appearedInNewRelease;
  const snoozeExpired =
    issue.status === "ignored" &&
    issue.ignoredUntil !== null &&
    issue.ignoredUntil <= next.timestamp;

  return { isRegression, shouldReopen: isRegression || snoozeExpired };
}
