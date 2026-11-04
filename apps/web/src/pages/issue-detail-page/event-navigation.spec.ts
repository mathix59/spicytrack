import { describe, expect, it, vi } from "vitest";

import type { EventDto } from "@/generated/api";

import { createEventNavigation } from "./event-navigation";

const events = ["e1", "e2", "e3"].map((id) => ({ id }) as EventDto);

function navigation(selectedEventIndex: number, safeEventPage: number, totalEventPages = 3) {
  const setters = {
    setSelectedEventId: vi.fn(),
    setEventPage: vi.fn(),
    setPageEntryEdge: vi.fn(),
  };
  return {
    ...setters,
    ...createEventNavigation({
      events,
      selectedEventIndex,
      safeEventPage,
      totalEventPages,
      ...setters,
    }),
  };
}

describe("createEventNavigation", () => {
  it("steps within the loaded page", () => {
    const nav = navigation(1, 2);
    nav.goNewer();
    expect(nav.setSelectedEventId).toHaveBeenLastCalledWith("e1");
    nav.goOlder();
    expect(nav.setSelectedEventId).toHaveBeenLastCalledWith("e3");
    expect(nav.setEventPage).not.toHaveBeenCalled();
  });

  it("enters the neighbouring page at the end closest to the current event", () => {
    const newer = navigation(0, 2);
    newer.goNewer();
    expect(newer.setEventPage).toHaveBeenCalledWith(1);
    expect(newer.setPageEntryEdge).toHaveBeenCalledWith("last");
    expect(newer.setSelectedEventId).toHaveBeenCalledWith(null);

    const older = navigation(2, 2);
    older.goOlder();
    expect(older.setEventPage).toHaveBeenCalledWith(3);
    expect(older.setPageEntryEdge).toHaveBeenCalledWith("first");
  });

  it("stops at the newest and oldest events", () => {
    const first = navigation(0, 1);
    first.goNewer();
    expect(first.setSelectedEventId).not.toHaveBeenCalled();
    expect(first.setEventPage).not.toHaveBeenCalled();

    const last = navigation(2, 3);
    last.goOlder();
    expect(last.setSelectedEventId).not.toHaveBeenCalled();
    expect(last.setEventPage).not.toHaveBeenCalled();
  });

  it("jumps to the newest and oldest events", () => {
    const middle = navigation(1, 2);
    middle.goNewest();
    expect(middle.setEventPage).toHaveBeenLastCalledWith(1);
    expect(middle.setPageEntryEdge).toHaveBeenLastCalledWith("first");
    middle.goOldest();
    expect(middle.setEventPage).toHaveBeenLastCalledWith(3);
    expect(middle.setPageEntryEdge).toHaveBeenLastCalledWith("last");

    const single = navigation(1, 1, 1);
    single.goNewest();
    expect(single.setSelectedEventId).toHaveBeenLastCalledWith("e1");
    single.goOldest();
    expect(single.setSelectedEventId).toHaveBeenLastCalledWith("e3");
  });
});
