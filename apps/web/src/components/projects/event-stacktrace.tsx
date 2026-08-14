import { EventDetails } from "@/components/projects/event-details";

import { RawPayloadCard } from "./event-stacktrace/raw-payload-card";
import { StackFrameList } from "./event-stacktrace/stack-frame-list";
import type { EventStacktraceProps } from "./event-stacktrace/types";
import { useEventStacktrace } from "./event-stacktrace/use-event-stacktrace";

function EventStacktrace(props: EventStacktraceProps) {
  const state = useEventStacktrace(props);

  if (state.displayFrames.length === 0) {
    return (
      <div className="grid min-w-0 gap-3">
        <EventDetails rawPayload={props.rawPayload} />
        <RawPayloadCard rawPayload={props.rawPayload} summary="No stack trace, view raw payload" />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <StackFrameList
        expanded={state.expanded}
        frames={state.displayFrames}
        onToggle={state.toggle}
      />
      <EventDetails rawPayload={props.rawPayload} />
      <RawPayloadCard rawPayload={props.rawPayload} summary="View raw payload" />
    </div>
  );
}

export { EventStacktrace };
