import { redactEventPayload } from "../common/event-payload-redaction";
import { asString, getAllFrames } from "../common/grouping";
import type { SourcemapResolverService } from "./sourcemap-resolver.service";

const MAX_EXCEPTION_VALUE = 1000;

export type StackFrameView = {
  function: string;
  path: string;
  lineno: number | null;
  colno: number | null;
  inApp: boolean | null;
  /** True when a source map, ProGuard or Dart symbols gave the original location. */
  mapped: boolean;
  contextLine: string | null;
};

export type ResolvedStack = {
  /** "Type: value" of the innermost exception, or the event message. */
  header: string | null;
  /** Newest call first. Only in-app frames when the SDK marked some. */
  frames: StackFrameView[];
  totalFrames: number;
};

/** The event's error and stack, redacted and source-mapped with the release's artifacts. */
export async function resolveEventStack(
  resolver: SourcemapResolverService,
  event: {
    rawPayload: unknown;
    releaseId: string | null;
    sdkName: string | null;
    platform: string | null;
  },
  options: { maxFrames: number; allFrames?: boolean },
): Promise<ResolvedStack> {
  const payload = redactEventPayload((event.rawPayload ?? {}) as Record<string, unknown>);
  const exception = payload.exception as { values?: unknown[] } | unknown[] | undefined;
  const values = Array.isArray(exception) ? exception : (exception?.values ?? []);
  const last = values.at(-1) as Record<string, unknown> | undefined;
  const type = asString(last?.type);
  const value = asString(last?.value)?.slice(0, MAX_EXCEPTION_VALUE) ?? null;
  const header = [type, value].filter(Boolean).join(": ") || asString(payload.message) || null;

  const rawFrames = getAllFrames(payload);
  const resolved = await resolver.resolveFrames({
    releaseId: event.releaseId,
    frames: rawFrames,
    sdkName: event.sdkName,
    platform: event.platform,
  });
  const frames = rawFrames.map((frame, index): StackFrameView => {
    const mapped = resolved[index]?.resolved ? resolved[index] : null;
    return {
      function: mapped?.function ?? frame.function ?? "<anonymous>",
      path: mapped?.filename ?? frame.filename ?? frame.absPath ?? frame.module ?? "?",
      lineno: mapped?.lineno ?? frame.lineno ?? null,
      colno: mapped?.colno ?? frame.colno ?? null,
      inApp: frame.inApp ?? null,
      mapped: Boolean(mapped && mapped.resolution !== "original"),
      contextLine: mapped?.contextLine ?? frame.contextLine ?? null,
    };
  });
  const hasInApp = frames.some((frame) => frame.inApp === true);
  const shown = options.allFrames
    ? frames
    : frames.filter((frame) => (hasInApp ? frame.inApp === true : frame.inApp !== false));
  return {
    header,
    frames: shown.reverse().slice(0, options.maxFrames),
    totalFrames: rawFrames.length,
  };
}
