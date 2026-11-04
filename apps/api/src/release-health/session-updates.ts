/** Session outcomes, by severity: an update can raise a session's outcome, never lower it. */
export const SESSION_OUTCOME = { healthy: 0, errored: 1, abnormal: 2, crashed: 3 } as const;
export type SessionOutcome = (typeof SESSION_OUTCOME)[keyof typeof SESSION_OUTCOME];

/** Sessions that started longer ago are dropped: their earlier updates are no longer tracked. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AGGREGATE_COUNT = 1_000_000;

export type SessionUpdate = {
  sessionId: string;
  distinctId: string | null;
  releaseVersion: string;
  environment: string;
  startedAt: Date;
  outcome: SessionOutcome;
};

export type SessionAggregate = {
  releaseVersion: string;
  environment: string;
  startedAt: Date;
  distinctId: string | null;
  sessions: number;
  errored: number;
  abnormal: number;
  crashed: number;
};

type Attributes = { releaseVersion: string; environment: string };

function shortString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function attributes(payload: Record<string, unknown>): Attributes | null {
  const attrs =
    payload.attrs && typeof payload.attrs === "object"
      ? (payload.attrs as Record<string, unknown>)
      : {};
  const releaseVersion = shortString(attrs.release, 255);
  if (!releaseVersion) return null;
  return {
    releaseVersion,
    environment: (typeof attrs.environment === "string" ? attrs.environment.trim() : "").slice(
      0,
      128,
    ),
  };
}

/** Start time, clamped to now when the client clock runs ahead; null when unusable or too old. */
function startTime(value: unknown, now: Date) {
  const time =
    typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time) || time < now.getTime() - SESSION_MAX_AGE_MS) return null;
  return new Date(Math.min(time, now.getTime()));
}

function outcomeOf(status: unknown, errors: unknown): SessionOutcome {
  if (status === "crashed") return SESSION_OUTCOME.crashed;
  if (status === "abnormal") return SESSION_OUTCOME.abnormal;
  if (status === "errored") return SESSION_OUTCOME.errored;
  return typeof errors === "number" && errors > 0
    ? SESSION_OUTCOME.errored
    : SESSION_OUTCOME.healthy;
}

function count(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_AGGREGATE_COUNT)
    : 0;
}

/** Reads a `session` item; null when it lacks a session id, a release or a recent start. */
export function normalizeSessionUpdate(
  payload: Record<string, unknown>,
  now = new Date(),
): SessionUpdate | null {
  const sessionId = shortString(payload.sid, 64);
  const attrs = attributes(payload);
  const startedAt = startTime(payload.started ?? payload.timestamp, now);
  if (!sessionId || !attrs || !startedAt) return null;
  return {
    sessionId,
    distinctId: shortString(payload.did, 512),
    ...attrs,
    startedAt,
    outcome: outcomeOf(payload.status, payload.errors),
  };
}

/** Reads a `sessions` item: per-minute counts sent by server SDKs instead of single updates. */
export function normalizeSessionAggregates(
  payload: Record<string, unknown>,
  now = new Date(),
): SessionAggregate[] {
  const attrs = attributes(payload);
  if (!attrs || !Array.isArray(payload.aggregates)) return [];
  return payload.aggregates.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const group = entry as Record<string, unknown>;
    const startedAt = startTime(group.started, now);
    const errored = count(group.errored);
    const abnormal = count(group.abnormal);
    const crashed = count(group.crashed);
    const sessions = count(group.exited) + errored + abnormal + crashed;
    if (!startedAt || sessions === 0) return [];
    return [
      {
        ...attrs,
        startedAt,
        distinctId: shortString(group.did, 512),
        sessions,
        errored,
        abnormal,
        crashed,
      },
    ];
  });
}

export function hourStart(date: Date) {
  return new Date(Math.floor(date.getTime() / 3_600_000) * 3_600_000);
}
