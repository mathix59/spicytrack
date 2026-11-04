import type { EventDto } from "@/generated/api";

type EventPageEdge = "first" | "last";

type EventNavigationOptions = {
  events: EventDto[];
  selectedEventIndex: number;
  safeEventPage: number;
  totalEventPages: number;
  setSelectedEventId: (eventId: string | null) => void;
  setEventPage: (page: number) => void;
  setPageEntryEdge: (edge: EventPageEdge) => void;
};

/** Stepping through an issue's events, across event pages when the current page runs out. */
function createEventNavigation({
  events,
  selectedEventIndex,
  safeEventPage,
  totalEventPages,
  setSelectedEventId,
  setEventPage,
  setPageEntryEdge,
}: EventNavigationOptions) {
  // The selection clears until the page's events arrive, then the render-time sync in
  // useIssueDetailPage picks the requested end of that page.
  const enterEventPage = (page: number, edge: EventPageEdge) => {
    setEventPage(page);
    setPageEntryEdge(edge);
    setSelectedEventId(null);
  };

  const goNewer = () => {
    if (selectedEventIndex > 0) {
      setSelectedEventId(events[selectedEventIndex - 1].id);
      return;
    }

    if (safeEventPage > 1) {
      enterEventPage(safeEventPage - 1, "last");
    }
  };

  const goOlder = () => {
    if (selectedEventIndex >= 0 && selectedEventIndex < events.length - 1) {
      setSelectedEventId(events[selectedEventIndex + 1].id);
      return;
    }

    if (safeEventPage < totalEventPages) {
      enterEventPage(safeEventPage + 1, "first");
    }
  };

  const goNewest = () => {
    if (safeEventPage > 1) enterEventPage(1, "first");
    else if (events.length > 0) setSelectedEventId(events[0].id);
  };

  const goOldest = () => {
    if (safeEventPage < totalEventPages) enterEventPage(totalEventPages, "last");
    else if (events.length > 0) setSelectedEventId(events[events.length - 1].id);
  };

  return { goNewer, goOlder, goNewest, goOldest };
}

export { createEventNavigation };
export type { EventPageEdge };
