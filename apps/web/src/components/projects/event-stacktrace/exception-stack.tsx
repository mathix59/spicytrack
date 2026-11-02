import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";

import { StackFrameList } from "./stack-frame-list";
import type { EventException } from "./types";
import { type StackView, useExceptionStack } from "./use-event-stacktrace";

function ExceptionTitle({
  exception,
  causedBy,
}: {
  exception: EventException;
  causedBy?: boolean;
}) {
  return (
    <div className="min-w-0">
      {causedBy ? (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Caused by
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {exception.type ?? "Error"}
        </span>
        {exception.handled === false ? <Badge variant="danger">unhandled</Badge> : null}
        {exception.mechanism ? <Badge variant="muted">{exception.mechanism}</Badge> : null}
      </p>
      {exception.value ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {exception.value}
        </p>
      ) : null}
    </div>
  );
}

function ExceptionStack({
  exception,
  causedBy = false,
}: {
  exception: EventException;
  causedBy?: boolean;
}) {
  const stack = useExceptionStack(exception);
  const hasFrames = exception.frames.length > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <header className="grid gap-3 border-b border-border px-4 py-3">
        <ExceptionTitle causedBy={causedBy} exception={exception} />
        {hasFrames ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {exception.frames.length} frames · most recent call first
            </p>
            <div className="flex items-center gap-1">
              {stack.hasLibraryFrames && stack.appFrameCount > 0 ? (
                <SegmentedControl<StackView>
                  label="Stack frames to show"
                  onChange={stack.setView}
                  options={[
                    { value: "app", label: "App", count: stack.appFrameCount },
                    { value: "full", label: "Full", count: exception.frames.length },
                  ]}
                  value={stack.view}
                />
              ) : null}
              <Button
                aria-label={stack.allExpanded ? "Collapse all frames" : "Expand all frames"}
                onClick={stack.toggleAll}
                size="icon-sm"
                title={stack.allExpanded ? "Collapse all frames" : "Expand all frames"}
                type="button"
                variant="ghost"
              >
                {stack.allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
              </Button>
            </div>
          </div>
        ) : null}
      </header>
      {hasFrames && !stack.hasResolvableAppSource ? (
        <p className="border-b border-border bg-warning/5 px-4 py-2.5 text-xs text-warning">
          No application source could be resolved in this stack. Check the release artifacts and
          captured frames; source maps cannot recover calls absent from the event.
        </p>
      ) : null}
      {hasFrames ? (
        <StackFrameList
          expanded={stack.expanded}
          onRevealGroup={stack.revealGroup}
          onToggle={stack.toggle}
          rows={stack.rows}
        />
      ) : (
        <p className="px-4 py-3 text-xs text-muted-foreground">No stack frames were captured.</p>
      )}
    </section>
  );
}

export { ExceptionStack };
