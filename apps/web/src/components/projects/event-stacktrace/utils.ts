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
    inApp: frame.in_app !== false && !/(?:^|[\\/])node_modules[\\/]/.test(filename),
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

export { extractExceptions, languageForFilename, splitPath };
