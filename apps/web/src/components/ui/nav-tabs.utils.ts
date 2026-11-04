import type { CSSProperties } from "react";

type ScrollEdges = { start: boolean; end: boolean };

const EDGE_FADE = "1.5rem";

/** Fades the edges that hide more tabs, hinting that the list scrolls. */
function edgeFadeMask({ start, end }: ScrollEdges): CSSProperties | undefined {
  if (!start && !end) return undefined;
  const gradient = `linear-gradient(to right, ${start ? "transparent" : "#000"}, #000 ${EDGE_FADE}, #000 calc(100% - ${EDGE_FADE}), ${end ? "transparent" : "#000"})`;
  return { maskImage: gradient, WebkitMaskImage: gradient };
}

/** The horizontal scroll offset that brings `item` fully into view, or null when it already is. */
function scrollLeftToReveal(
  list: { scrollLeft: number; clientWidth: number },
  item: { offsetLeft: number; offsetWidth: number },
) {
  const start = item.offsetLeft;
  const end = item.offsetLeft + item.offsetWidth;
  if (start < list.scrollLeft) return start;
  if (end > list.scrollLeft + list.clientWidth) return end - list.clientWidth;
  return null;
}

/** Which edges of a horizontally scrollable element hide content. */
function readScrollEdges(list: { scrollLeft: number; clientWidth: number; scrollWidth: number }) {
  // Sub-pixel layouts can leave a fraction of a pixel of "scroll"; ignore it.
  return {
    start: list.scrollLeft > 1,
    end: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
  };
}

export { edgeFadeMask, readScrollEdges, scrollLeftToReveal, type ScrollEdges };
