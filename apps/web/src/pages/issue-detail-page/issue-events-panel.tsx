import { ArrowLeft, ArrowRight } from "lucide-react";

import { EventMeta } from "@/components/issues/issue-metadata";
import { EventStacktrace } from "@/components/projects/event-stacktrace";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { renderNullableText } from "@/lib/utils";

import type { EventPagerState } from "./types";
import { formatTimelineDate } from "./utils";

function IssueEventsPanel({ events }: { events: EventPagerState }) {
  if (events.totalEvents === 0) {
    return <EmptyState title="No events" description="This issue has no stored events." />;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2">
        <p className="text-sm text-muted-foreground">
          {events.globalEventNumber
            ? `Event ${events.globalEventNumber} of ${events.totalEvents}`
            : `${events.totalEvents} events`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            disabled={!events.canGoNewer}
            onClick={events.goNewer}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            Newer
          </Button>
          <Button
            disabled={!events.canGoOlder}
            onClick={events.goOlder}
            size="sm"
            type="button"
            variant="ghost"
          >
            Older
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      {events.selectedEvent ? (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
            <EventMeta label="Event" value={events.selectedEvent.eventId.slice(0, 8)} />
            <EventMeta label="Time" value={formatTimelineDate(events.selectedEvent.timestamp)} />
            <EventMeta label="Level" value={events.selectedEvent.level} />
            <EventMeta
              label="Environment"
              value={renderNullableText(events.selectedEvent.environmentName, "not set")}
            />
            <EventMeta
              label="Release"
              value={renderNullableText(events.selectedEvent.releaseVersion, "not set")}
            />
          </div>
          <EventStacktrace
            rawPayload={events.selectedEvent.rawPayload}
            resolvedFrames={events.selectedEvent.resolvedFrames}
          />
        </>
      ) : (
        <EmptyState title="Loading event" description="Fetching event payload..." />
      )}
    </>
  );
}

export { IssueEventsPanel };
