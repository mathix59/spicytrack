import type { ResolvedFrameDto } from "@/generated/api";

import type { EventException, StackFrame } from "./types";

type PayloadRecord = Record<string, unknown>;

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PayloadRecord)
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function valuesOf(container: unknown): unknown[] {
  if (Array.isArray(container)) return container;
  const values = asRecord(container)?.values;
  return Array.isArray(values) ? values : [];
}

function framesOf(value: unknown): PayloadRecord[] {
  const frames = asRecord(asRecord(value)?.stacktrace)?.frames;
  return Array.isArray(frames)
    ? frames.filter((frame): frame is PayloadRecord => !!asRecord(frame))
    : [];
}

/**
 * Paths of third-party and standard-library code across platforms, used when a frame does not
 * say whether it is application code: package caches (npm, pip, Go modules, Cargo, gems),
 * vendored dependencies, the Rust standard library and browser-injected scripts.
 */
const LIBRARY_PATH_PATTERNS: readonly RegExp[] = [
  /(?:^|[\\/])node_modules[\\/]/,
  /(?:^|[\\/])(?:site|dist)-packages[\\/]/,
  /(?:^|\/)usr\/(?:local\/)?lib\/python[\d.]*\//,
  /(?:^|[\\/])vendor[\\/]/,
  /(?:^|[\\/])go[\\/]pkg[\\/]mod[\\/]/,
  /(?:^|[\\/])\.cargo[\\/]registry[\\/]/,
  /^\/rustc\//,
  /(?:^|[\\/])gems[\\/]/,
  /^webpack-internal:\/\/\/\(webpack\)/,
  /^(?:chrome|moz)-extension:\/\//,
];

/** JVM standard-library packages, matched on a frame's module. */
const LIBRARY_MODULE_PATTERN = /^(?:java|javax|jdk|sun|kotlin|kotlinx)\./;

/** Whether a frame without an explicit `in_app` looks like library code. */
function isLibraryFrame(paths: (string | null)[], module: string | null) {
  return (
    paths.some(
      (path) => path !== null && LIBRARY_PATH_PATTERNS.some((pattern) => pattern.test(path)),
    ) ||
    (module !== null && LIBRARY_MODULE_PATTERN.test(module))
  );
}

function toStackFrame(frame: PayloadRecord, resolvedFrame: ResolvedFrameDto | undefined) {
  const resolved = resolvedFrame?.resolved ? resolvedFrame : undefined;
  const filename =
    resolved?.filename ??
    asString(frame.filename) ??
    asString(frame.abs_path) ??
    asString(frame.module) ??
    "unknown";
  const mapped = resolved?.resolution === "sourcemap";

  return {
    filename,
    function: resolved?.function ?? asString(frame.function),
    lineno: resolved?.lineno || (typeof frame.lineno === "number" ? frame.lineno : 0),
    colno: resolved
      ? (resolved.colno ?? null)
      : typeof frame.colno === "number"
        ? frame.colno
        : null,
    inApp:
      typeof frame.in_app === "boolean"
        ? frame.in_app
        : !isLibraryFrame([filename, asString(frame.abs_path)], asString(frame.module)),
    preContext: mapped ? (resolved.preContext ?? []) : asStringArray(frame.pre_context),
    contextLine: mapped
      ? (resolved.contextLine ?? null)
      : typeof frame.context_line === "string"
        ? frame.context_line
        : null,
    postContext: mapped ? (resolved.postContext ?? []) : asStringArray(frame.post_context),
    resolved: resolvedFrame ? resolvedFrame.resolved : null,
    resolution: resolvedFrame?.resolution ?? null,
    diagnostic: resolvedFrame?.diagnostic ?? null,
  } satisfies StackFrame;
}

/**
 * Extracts every exception of an event, newest (the thrown one) first, with frames ordered
 * most recent call first. The API resolves frames over the concatenation of all exception
 * stacks (or thread stacks when there is no exception), so resolved frames are matched by
 * their offset in that same flattened list.
 */
function extractExceptions(
  rawPayload: PayloadRecord,
  resolvedFrames?: ResolvedFrameDto[],
): EventException[] {
  const exceptionValues = valuesOf(rawPayload.exception).filter((value) => !!asRecord(value));
  const sources: { value: PayloadRecord | null; frames: PayloadRecord[] }[] =
    exceptionValues.length > 0
      ? exceptionValues.map((value) => ({ value: asRecord(value), frames: framesOf(value) }))
      : [];

  const hasExceptionFrames = sources.some((source) => source.frames.length > 0);
  if (!hasExceptionFrames) {
    const threadFrames = valuesOf(rawPayload.threads).flatMap((thread) => framesOf(thread));
    if (threadFrames.length > 0) {
      if (sources.length > 0) sources[sources.length - 1].frames = threadFrames;
      else sources.push({ value: null, frames: threadFrames });
    }
  }

  const totalFrames = sources.reduce((sum, source) => sum + source.frames.length, 0);
  const canMatchResolved = !!resolvedFrames && resolvedFrames.length === totalFrames;
  // Misaligned frames are never matched (they would point at the wrong code), but the user is
  // told why the stack shows minified locations.
  const resolutionSkipped = !!resolvedFrames?.length && !canMatchResolved;

  let offset = 0;
  const exceptions = sources.map(({ value, frames }) => {
    const stackFrames = frames.map((frame, index) =>
      toStackFrame(frame, canMatchResolved ? resolvedFrames[offset + index] : undefined),
    );
    offset += frames.length;
    const mechanism = asRecord(value?.mechanism);
    return {
      type: asString(value?.type),
      value: asString(value?.value),
      module: asString(value?.module),
      handled: typeof mechanism?.handled === "boolean" ? mechanism.handled : null,
      mechanism: asString(mechanism?.type),
      frames: stackFrames.reverse(),
      resolutionSkipped: resolutionSkipped && frames.length > 0,
    } satisfies EventException;
  });

  return exceptions.reverse();
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  py: "python",
  go: "go",
  rs: "rust",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  m: "objectivec",
  sql: "sql",
  // No bundled grammar: the generic C-like grammar still highlights strings and keywords.
  java: "clike",
  cs: "clike",
  php: "clike",
  dart: "clike",
};

/** Prism language for a frame's file, falling back to plain text for unknown extensions. */
function languageForFilename(filename: string) {
  const extension = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(filename)?.[1]?.toLowerCase();
  return (extension && LANGUAGE_BY_EXTENSION[extension]) ?? "plain";
}

/** Splits a path into a dimmed directory and an emphasized file name. */
function splitPath(filename: string) {
  const index = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  return index >= 0
    ? { directory: filename.slice(0, index + 1), basename: filename.slice(index + 1) }
    : { directory: "", basename: filename };
}

function formatFrameLocation(frame: StackFrame) {
  return `${frame.filename}:${frame.lineno}${frame.colno != null ? `:${frame.colno}` : ""}`;
}

/**
 * Plain-text stack trace for pasting into tickets and chats: the thrown exception first, then
 * its causes, each with frames most recent call first in the conventional `at` notation.
 */
function formatStackTrace(exceptions: EventException[]) {
  return exceptions
    .flatMap((exception, index) => {
      const title = `${exception.type ?? "Error"}${exception.value ? `: ${exception.value}` : ""}`;
      return [
        index > 0 ? `Caused by: ${title}` : title,
        ...exception.frames.map(
          (frame) => `  at ${frame.function ?? "<anonymous>"} (${formatFrameLocation(frame)})`,
        ),
      ];
    })
    .join("\n");
}

export {
  extractExceptions,
  formatFrameLocation,
  formatStackTrace,
  isLibraryFrame,
  languageForFilename,
  splitPath,
};
