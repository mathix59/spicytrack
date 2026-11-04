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

type EventException = {
  type: string | null;
  value: string | null;
  module: string | null;
  handled: boolean | null;
  mechanism: string | null;
  /** Most recent call first. */
  frames: StackFrame[];
  /** Resolved frames were available but did not line up with the raw frames, so none applied. */
  resolutionSkipped: boolean;
};

type EventStacktraceProps = {
  rawPayload: Record<string, unknown>;
  resolvedFrames?: ResolvedFrameDto[];
};

export type { EventException, EventStacktraceProps, StackFrame };
