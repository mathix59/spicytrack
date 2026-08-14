import type { ResolvedFrameDto } from "@/generated/api";

type StackFrame = {
  filename: string;
  function: string | null;
  lineno: number;
  colno: number | null;
  inApp: boolean;
  preContext: string[];
  contextLine: string | null;
  postContext: string[];
  resolved: boolean | null;
  resolution: ResolvedFrameDto["resolution"] | null;
  diagnostic: string | null;
};

type EventStacktraceProps = {
  rawPayload: Record<string, unknown>;
  resolvedFrames?: ResolvedFrameDto[];
};

export type { EventStacktraceProps, StackFrame };
