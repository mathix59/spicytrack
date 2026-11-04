import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { EventStacktrace } from "@/components/projects/event-stacktrace";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";

import type { EventPagerState } from "./types";
import { formatTimelineDate } from "./utils";

function MetaItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? "truncate font-medium text-foreground" : "text-muted-foreground"}>
        {value || "not set"}
      </span>
    </span>
  );
}

function IssueEventsPanel({ events }: { events: EventPagerState }) {
  if (events.totalEvents === 0) {
    return <EmptyState description="This issue has no stored events." title="No events" />;
  }

  const event = events.selectedEvent;

  return (
    <>
      <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {events.globalEventNumber
              ? `Event ${events.globalEventNumber} of ${events.totalEvents}`
              : `${events.totalEvents} events`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              aria-label="Newest event"
              disabled={!events.canGoNewer}
              onClick={events.goNewest}
              size="sm"
              title="Newest event"
              type="button"
              variant="ghost"
            >
              <ChevronsLeft />
              <span className="hidden sm:inline">Newest</span>
            </Button>
            <Button
              aria-keyshortcuts="["
              disabled={!events.canGoNewer}
              onClick={events.goNewer}
              size="sm"
              title="Newer event ([)"
              type="button"
              variant="ghost"
            >
              <ChevronLeft />
              Newer
              <Kbd className="hidden md:inline-flex">[</Kbd>
            </Button>
            <Button
              aria-keyshortcuts="]"
              disabled={!events.canGoOlder}
              onClick={events.goOlder}
              size="sm"
              title="Older event (])"
              type="button"
              variant="ghost"
            >
              <Kbd className="hidden md:inline-flex">]</Kbd>
              Older
              <ChevronRight />
            </Button>
            <Button
              aria-label="Oldest event"
              disabled={!events.canGoOlder}
              onClick={events.goOldest}
              size="sm"
              title="Oldest event"
              type="button"
              variant="ghost"
            >
              <span className="hidden sm:inline">Oldest</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
        {event ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono font-medium">{event.eventId.slice(0, 8)}</span>
              <CopyButton
                className="size-6"
                label="Copy event ID"
                successMessage="Event ID copied"
                value={event.eventId}
              />
            </span>
            <MetaItem label="Time" value={formatTimelineDate(event.timestamp)} />
            <MetaItem label="Level" value={event.level} />
            <MetaItem label="Environment" value={event.environmentName} />
            <MetaItem label="Release" value={event.releaseVersion} />
          </div>
        ) : null}
      </div>

      {event ? (
        <EventStacktrace rawPayload={event.rawPayload} resolvedFrames={event.resolvedFrames} />
      ) : events.eventError ? (
        <QueryError
          error={events.eventError}
          onRetry={events.retryEvent}
          title="Could not load this event"
        />
      ) : (
        <div aria-busy="true" aria-label="Loading event" className="grid gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </>
  );
}

export { IssueEventsPanel };
