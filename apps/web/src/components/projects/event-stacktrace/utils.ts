import type { ResolvedFrameDto } from "@/generated/api";

import type { StackFrame } from "./types";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractFrames(
  rawPayload: Record<string, unknown>,
  resolvedFrames?: ResolvedFrameDto[],
): StackFrame[] {
  const exception = rawPayload.exception as { values?: unknown[] } | undefined;
  const first = Array.isArray(exception?.values) ? exception.values[0] : null;
  if (!first || typeof first !== "object") {
    return [];
  }

  const stacktrace = (first as { stacktrace?: { frames?: unknown[] } }).stacktrace;
  const rawFrames = Array.isArray(stacktrace?.frames) ? stacktrace.frames : [];

  return rawFrames
    .filter((frame): frame is Record<string, unknown> => !!frame && typeof frame === "object")
    .map((frame, index) => {
      const resolvedFrame =
        resolvedFrames && resolvedFrames.length === rawFrames.length
          ? resolvedFrames[index]
          : undefined;

      return {
        filename:
          resolvedFrame?.resolved && resolvedFrame.filename
            ? resolvedFrame.filename
            : typeof frame.filename === "string"
              ? frame.filename
              : typeof frame.module === "string"
                ? frame.module
                : "unknown",
        function:
          resolvedFrame?.resolved && resolvedFrame.function
            ? resolvedFrame.function
            : typeof frame.function === "string"
              ? frame.function
              : null,
        lineno:
          resolvedFrame?.resolved && resolvedFrame.lineno
            ? resolvedFrame.lineno
            : typeof frame.lineno === "number"
              ? frame.lineno
              : 0,
        colno: typeof frame.colno === "number" ? frame.colno : null,
        inApp: frame.in_app !== false,
        preContext: asStringArray(frame.pre_context),
        contextLine: typeof frame.context_line === "string" ? frame.context_line : null,
        postContext: asStringArray(frame.post_context),
        resolved: resolvedFrame ? resolvedFrame.resolved : null,
        resolution: resolvedFrame?.resolution ?? null,
        diagnostic: resolvedFrame?.diagnostic ?? null,
      };
    });
}

export { extractFrames };
