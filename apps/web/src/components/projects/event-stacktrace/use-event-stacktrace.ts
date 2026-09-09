import { useMemo, useState } from "react";

import type { EventStacktraceProps } from "./types";
import type { StackFrame } from "./types";
import { extractFrames } from "./utils";

function useEventStacktrace({ rawPayload, resolvedFrames }: EventStacktraceProps) {
  const frames = useMemo(
    () => extractFrames(rawPayload, resolvedFrames),
    [rawPayload, resolvedFrames],
  );
  const displayFrames = useMemo(() => [...frames].reverse(), [frames]);
  const appContextIndex = displayFrames.findIndex(
    (frame) => frame.inApp && frame.contextLine !== null,
  );
  const defaultExpandedIndex =
    appContextIndex >= 0
      ? appContextIndex
      : displayFrames.findIndex((frame) => frame.contextLine !== null);
  const [selection, setSelection] = useState<{
    frames: StackFrame[];
    expanded: Set<number>;
  } | null>(null);
  const expanded =
    selection?.frames === displayFrames
      ? selection.expanded
      : new Set(defaultExpandedIndex >= 0 ? [defaultExpandedIndex] : []);
  const toggle = (index: number) => {
    const next = new Set(expanded);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelection({ frames: displayFrames, expanded: next });
  };

  return {
    displayFrames,
    expanded,
    toggle,
  };
}

export { useEventStacktrace };
