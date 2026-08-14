import { randomBytes } from "node:crypto";

export function normalizeMessage(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function computeIssueTitle(payload: Record<string, unknown>) {
  const exception = getPrimaryException(payload);
  const message = normalizeMessage(asString(payload.message));

  if (exception?.type && exception?.value) {
    return `${exception.type}: ${exception.value}`;
  }

  if (exception?.type) {
    return exception.type;
  }

  return message || "Unhandled event";
}

export function computeGroupingKey(payload: Record<string, unknown>) {
  const fingerprint = payload.fingerprint;
  if (Array.isArray(fingerprint) && fingerprint.length > 0) {
    return `fingerprint:${fingerprint.join("|")}`;
  }

  const exception = getPrimaryException(payload);
  const frameKey = getFrameKey(payload);
  const message = normalizeMessage(asString(payload.message));

  return [exception?.type ?? "unknown", (exception?.value ?? message) || "unknown", frameKey].join(
    "|",
  );
}

export function createExternalEventId() {
  return randomBytes(16).toString("hex");
}

export function getPrimaryException(payload: Record<string, unknown>) {
  const [first] = getExceptionValues(payload);
  if (!first || typeof first !== "object") {
    return null;
  }

  const record = first as Record<string, unknown>;
  return {
    type: asString(record.type),
    value: asString(record.value),
  };
}

export function getFrameKey(payload: Record<string, unknown>) {
  const frame = getAllFrames(payload).at(-1);
  if (!frame) {
    return "no-frame";
  }
  return [
    frame.filename ?? frame.absPath ?? frame.module ?? "unknown",
    frame.function ?? "unknown",
    frame.lineno ?? 0,
  ].join(":");
}

export interface RawStackFrame {
  filename?: string | null;
  absPath?: string | null;
  module?: string | null;
  package?: string | null;
  function?: string | null;
  lineno?: number | null;
  colno?: number | null;
}

export function getAllFrames(payload: Record<string, unknown>): RawStackFrame[] {
  const exceptionFrames = getExceptionValues(payload).flatMap((value) => stacktraceFrames(value));
  const frames = exceptionFrames.length > 0 ? exceptionFrames : getThreadFrames(payload);

  return frames
    .filter((frame): frame is Record<string, unknown> => !!frame && typeof frame === "object")
    .map((frame) => ({
      filename: asString(frame.filename),
      absPath: asString(frame.abs_path),
      module: asString(frame.module),
      package: asString(frame.package),
      function: asString(frame.function),
      lineno: asNumber(frame.lineno),
      colno: asNumber(frame.colno),
    }));
}

function getExceptionValues(payload: Record<string, unknown>): unknown[] {
  const exception = payload.exception;
  if (Array.isArray(exception)) return exception;
  if (!exception || typeof exception !== "object") return [];
  const values = (exception as { values?: unknown[] }).values;
  return Array.isArray(values) ? values : [];
}

function stacktraceFrames(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const stacktrace = (value as { stacktrace?: { frames?: unknown[] } }).stacktrace;
  return Array.isArray(stacktrace?.frames) ? stacktrace.frames : [];
}

function getThreadFrames(payload: Record<string, unknown>): unknown[] {
  const threads = payload.threads;
  const values = Array.isArray(threads)
    ? threads
    : threads &&
        typeof threads === "object" &&
        Array.isArray((threads as { values?: unknown[] }).values)
      ? (threads as { values: unknown[] }).values
      : [];
  return values.flatMap((value) => stacktraceFrames(value));
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
