import { describe, expect, it } from "vitest";

import { readScrollEdges, scrollLeftToReveal } from "./nav-tabs.utils";

describe("scrollLeftToReveal", () => {
  const list = { scrollLeft: 100, clientWidth: 300 };

  it("leaves a fully visible tab alone", () => {
    expect(scrollLeftToReveal(list, { offsetLeft: 150, offsetWidth: 80 })).toBeNull();
  });

  it("scrolls back to a tab hidden on the left", () => {
    expect(scrollLeftToReveal(list, { offsetLeft: 40, offsetWidth: 80 })).toBe(40);
  });

  it("scrolls just enough to reveal a tab hidden on the right", () => {
    expect(scrollLeftToReveal(list, { offsetLeft: 380, offsetWidth: 90 })).toBe(170);
  });
});

describe("readScrollEdges", () => {
  it("reports no hidden content when the list fits", () => {
    expect(readScrollEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toEqual({
      start: false,
      end: false,
    });
  });

  it("reports hidden content on each side", () => {
    expect(readScrollEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: false,
      end: true,
    });
    expect(readScrollEdges({ scrollLeft: 150, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: true,
      end: true,
    });
    expect(readScrollEdges({ scrollLeft: 300, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: true,
      end: false,
    });
  });
});
