import { useMemo } from "react";

import { EventContextSummary, EventDetails, EventTags } from "@/components/projects/event-details";

import { FailedRequests } from "./event-details/failed-requests";
import { ExceptionStack } from "./event-stacktrace/exception-stack";
import { RawPayloadCard } from "./event-stacktrace/raw-payload-card";
import type { EventStacktraceProps } from "./event-stacktrace/types";
import { extractExceptions, formatStackTrace } from "./event-stacktrace/utils";

function EventStacktrace({ rawPayload, resolvedFrames }: EventStacktraceProps) {
  const exceptions = useMemo(
    () => extractExceptions(rawPayload, resolvedFrames),
    [rawPayload, resolvedFrames],
  );
  const stackTraceText = useMemo(() => formatStackTrace(exceptions), [exceptions]);
  // The copy action sits in the toolbar of the first card that has one.
  const copyHostIndex = exceptions.findIndex((exception) => exception.frames.length > 0);
  // Stack view state (expanded frames, revealed groups) resets whenever the event changes.
  const eventKey = typeof rawPayload.event_id === "string" ? rawPayload.event_id : "event";

  return (
    <div className="grid min-w-0 gap-3">
      <EventTags rawPayload={rawPayload} />
      <EventContextSummary rawPayload={rawPayload} />
      <FailedRequests rawPayload={rawPayload} />
      {exceptions.map((exception, index) => (
        <ExceptionStack
          causedBy={index > 0}
          copyText={index === copyHostIndex ? stackTraceText : undefined}
          exception={exception}
          key={`${eventKey}:${index}`}
        />
      ))}
      <EventDetails rawPayload={rawPayload} />
      <RawPayloadCard rawPayload={rawPayload} />
    </div>
  );
}

export { EventStacktrace };
