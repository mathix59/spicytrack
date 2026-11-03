import { createHash, randomBytes } from "node:crypto";

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

// The key sits in a unique btree index, whose rows cannot exceed ~2.7 KB. Longer keys (huge
// exception messages, long fingerprints) are replaced by their hash; shorter ones are kept
// verbatim so existing issues keep matching.
const MAX_GROUPING_KEY_BYTES = 2_000;

export function boundGroupingKey(key: string) {
  if (Buffer.byteLength(key, "utf8") <= MAX_GROUPING_KEY_BYTES) {
    return key;
  }

  return `sha256:${createHash("sha256").update(key).digest("hex")}`;
}

export const GROUPING_VERSION = 2;

export type GroupingKeys = {
  /** Current (v2) key; issues are created and looked up with it. */
  groupingKey: string;
  /** v1 key of the same event, used once to adopt an issue created before v2. Null when equal. */
  legacyGroupingKey: string | null;
};

export function computeGroupingKeys(payload: Record<string, unknown>): GroupingKeys {
  const groupingKey = computeGroupingKey(payload);
  const legacyGroupingKey = computeLegacyGroupingKey(payload);
  return {
    groupingKey,
    legacyGroupingKey: legacyGroupingKey === groupingKey ? null : legacyGroupingKey,
  };
}

/**
 * v2 grouping. Stable across deploys and variable data: no line numbers, bundle hashes or
 * deploy-specific path prefixes, and ids, numbers, URLs, emails and dates in the message are
 * replaced by placeholders. The crash location is the innermost application (in-app) frame.
 */
export function computeGroupingKey(payload: Record<string, unknown>) {
  const defaultKey = computeDefaultGroupingKey(payload);
  const fingerprint = payload.fingerprint;
  if (Array.isArray(fingerprint) && fingerprint.length > 0) {
    const parts = fingerprint.map((part) =>
      isDefaultFingerprintPart(part) ? defaultKey : String(part),
    );
    return boundGroupingKey(`fingerprint:${parts.join("|")}`);
  }

  return boundGroupingKey(defaultKey);
}

export function computeDefaultGroupingKey(payload: Record<string, unknown>) {
  const exception = getPrimaryException(payload);
  const message = normalizeMessage(asString(payload.message));
  const value = normalizeVariableText((exception?.value ?? message) || "unknown");

  return ["v2", exception?.type ?? "unknown", value, crashLocation(payload)].join("|");
}

function isDefaultFingerprintPart(part: unknown) {
  return typeof part === "string" && /^\{\{\s*default\s*\}\}$/.test(part.trim());
}

const VARIABLE_PATTERNS: Array<[RegExp, string]> = [
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>"],
  [/\bhttps?:\/\/[^\s"'<>)]+/gi, "<url>"],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, "<email>"],
  [
    /\b\d{4}-\d{2}-\d{2}(?:[t ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:z|[+-]\d{2}:?\d{2})?)?\b/gi,
    "<date>",
  ],
  [/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<ip>"],
  [/\b0x[0-9a-f]+\b/gi, "<hex>"],
  [/\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{12,}\b/gi, "<hex>"],
  // Short integers are kept: they are usually meaningful (HTTP statuses, error codes).
  [/\b\d+\.\d+\b|\b\d{4,}\b/g, "<n>"],
];

export function normalizeVariableText(value: string) {
  return VARIABLE_PATTERNS.reduce(
    (text, [pattern, placeholder]) => text.replace(pattern, placeholder),
    normalizeMessage(value),
  );
}

function crashLocation(payload: Record<string, unknown>) {
  const frames = getAllFrames(payload);
  if (frames.length === 0) return "no-frame";

  // Frames are ordered from the outermost call to the crashing one.
  const frame =
    frames.findLast((candidate) => candidate.inApp === true) ??
    frames.findLast((candidate) => candidate.inApp !== false && !isLibraryFrame(candidate)) ??
    frames.at(-1)!;

  return `${frameLocation(frame)}:${frameFunction(frame)}`;
}

function isLibraryFrame(frame: RawStackFrame) {
  const location = frame.absPath ?? frame.filename ?? "";
  return /(?:^|[\\/])node_modules[\\/]|^node:|^internal[\\/]|^native$|<anonymous>/.test(location);
}

function frameLocation(frame: RawStackFrame) {
  if (frame.module) return frame.module;
  const location = frame.filename ?? frame.absPath;
  if (!location) return "unknown";

  const path = location
    .replace(/[?#].*$/, "")
    .replace(/^[a-z][\w+.-]*:\/\/[^/]*/i, "")
    .replace(/\\/g, "/");
  // The last two segments survive deploy directories (/srv/releases/<sha>/…) and CDN prefixes.
  const segments = path.split("/").filter(Boolean).slice(-2);
  return segments.map(stripContentHash).join("/") || "unknown";
}

/** app.3f2a1b9c.js → app.js, index-D6Sueoy0.js → index.js */
function stripContentHash(segment: string) {
  return segment.replace(
    /[.-](?=[A-Za-z0-9_]*\d)(?=[A-Za-z0-9_]*[A-Za-z])[A-Za-z0-9_]{6,20}(?=\.[a-z0-9]+$)/,
    "",
  );
}

function frameFunction(frame: RawStackFrame) {
  const name = frame.function?.trim();
  // Minified names (`t`, `e`, `Xo`) change with every build.
  if (!name || name.length <= 2 || name === "?" || name === "<anonymous>") return "?";
  return name;
}

/** Grouping before v2, kept verbatim so issues created by it can be adopted. */
export function computeLegacyGroupingKey(payload: Record<string, unknown>) {
  return boundGroupingKey(computeRawGroupingKey(payload));
}

function computeRawGroupingKey(payload: Record<string, unknown>) {
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
  inApp?: boolean | null;
  /** Source line the SDK attached, when it had the original file. */
  contextLine?: string | null;
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
      inApp: typeof frame.in_app === "boolean" ? frame.in_app : null,
      contextLine: asString(frame.context_line),
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
