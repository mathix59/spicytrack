import { useCallback, useMemo, useState } from "react";

import type { EventException, StackFrame } from "./types";

type FrameRow =
  | { kind: "frame"; frame: StackFrame; index: number }
  | { kind: "collapsed"; start: number; count: number };

type StackView = "app" | "full";

function defaultExpandedIndex(frames: StackFrame[]) {
  const appIndex = frames.findIndex((frame) => frame.inApp && frame.contextLine !== null);
  if (appIndex >= 0) return appIndex;
  return frames.findIndex((frame) => frame.contextLine !== null);
}

/**
 * Builds the visible rows of one exception stack. In "app" view, runs of library frames
 * collapse into a single row unless the user revealed them.
 */
function buildRows(frames: StackFrame[], view: StackView, revealed: Set<number>): FrameRow[] {
  if (view === "full") {
    return frames.map((frame, index) => ({ kind: "frame", frame, index }));
  }

  const rows: FrameRow[] = [];
  let index = 0;
  while (index < frames.length) {
    if (frames[index].inApp) {
      rows.push({ kind: "frame", frame: frames[index], index });
      index += 1;
      continue;
    }
    const start = index;
    while (index < frames.length && !frames[index].inApp) index += 1;
    if (revealed.has(start)) {
      for (let cursor = start; cursor < index; cursor += 1) {
        rows.push({ kind: "frame", frame: frames[cursor], index: cursor });
      }
    } else {
      rows.push({ kind: "collapsed", start, count: index - start });
    }
  }
  return rows;
}

/** View state for one exception stack. Callers key the component by event to reset it. */
function useExceptionStack(exception: EventException) {
  const { frames } = exception;
  const appFrameCount = useMemo(() => frames.filter((frame) => frame.inApp).length, [frames]);
  const hasLibraryFrames = appFrameCount < frames.length;
  const [view, setView] = useState<StackView>(appFrameCount > 0 ? "app" : "full");
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const index = defaultExpandedIndex(frames);
    return new Set(index >= 0 ? [index] : []);
  });

  const rows = useMemo(() => buildRows(frames, view, revealed), [frames, view, revealed]);

  const toggle = useCallback((index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const revealGroup = useCallback((start: number) => {
    setRevealed((current) => new Set(current).add(start));
  }, []);

  const allExpanded = frames.length > 0 && expanded.size === frames.length;
  const toggleAll = useCallback(() => {
    setExpanded(allExpanded ? new Set() : new Set(frames.map((_, index) => index)));
    if (!allExpanded) setView("full");
  }, [allExpanded, frames]);

  return {
    rows,
    view,
    setView,
    expanded,
    toggle,
    revealGroup,
    allExpanded,
    toggleAll,
    appFrameCount,
    hasLibraryFrames,
    hasResolvableAppSource: frames.some(
      (frame) => frame.inApp && (frame.resolved !== false || frame.contextLine !== null),
    ),
  };
}

export { useExceptionStack, type FrameRow, type StackView };
