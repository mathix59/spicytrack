import { useMemo, useState } from "react";

import type { EventStacktraceProps } from "./types";
import { extractFrames } from "./utils";

function useEventStacktrace({ rawPayload, resolvedFrames }: EventStacktraceProps) {
  const frames = useMemo(
    () => extractFrames(rawPayload, resolvedFrames),
    [rawPayload, resolvedFrames],
  );
  const displayFrames = useMemo(() => [...frames].reverse(), [frames]);
  const defaultExpandedIndex = displayFrames.findIndex((frame) => frame.contextLine !== null);
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(defaultExpandedIndex >= 0 ? [defaultExpandedIndex] : []),
  );

  const toggle = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return {
    displayFrames,
    expanded,
    toggle,
  };
}

export { useEventStacktrace };
