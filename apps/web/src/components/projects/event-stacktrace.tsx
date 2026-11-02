import { useMemo } from "react";

import { EventDetails, EventTags } from "@/components/projects/event-details";

import { FailedRequests } from "./event-details/failed-requests";
import { ExceptionStack } from "./event-stacktrace/exception-stack";
import { RawPayloadCard } from "./event-stacktrace/raw-payload-card";
import type { EventStacktraceProps } from "./event-stacktrace/types";
import { extractExceptions } from "./event-stacktrace/utils";

function EventStacktrace({ rawPayload, resolvedFrames }: EventStacktraceProps) {
  const exceptions = useMemo(
    () => extractExceptions(rawPayload, resolvedFrames),
    [rawPayload, resolvedFrames],
  );
  // Stack view state (expanded frames, revealed groups) resets whenever the event changes.
  const eventKey = typeof rawPayload.event_id === "string" ? rawPayload.event_id : "event";

  return (
    <div className="grid min-w-0 gap-3">
      <EventTags rawPayload={rawPayload} />
      <FailedRequests rawPayload={rawPayload} />
      {exceptions.map((exception, index) => (
        <ExceptionStack causedBy={index > 0} exception={exception} key={`${eventKey}:${index}`} />
      ))}
      <EventDetails rawPayload={rawPayload} />
      <RawPayloadCard rawPayload={rawPayload} />
    </div>
  );
}

export { EventStacktrace };
