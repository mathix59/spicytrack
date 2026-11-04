import { memo } from "react";
import { ChevronRight, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { FrameSource } from "./frame-source";
import type { StackFrame } from "./types";
import type { FrameRow } from "./use-event-stacktrace";
import { formatFrameLocation, splitPath } from "./utils";

function resolutionLabel(resolution: StackFrame["resolution"]) {
  if (resolution === "sourcemap") return "source map";
  if (resolution === "proguard" || resolution === "dart_obfuscation") return "deobfuscated";
  return null;
}

function missingSourceMessage(frame: StackFrame) {
  if (frame.resolution === "sourcemap" && frame.resolved) {
    return "Location resolved, but this source map does not include the original source text.";
  }
  switch (frame.diagnostic) {
    case "artifact_not_found":
      return "No uploaded artifact matches this script in the event's release. It may be an external or injected script.";
    case "no_release":
      return "This event has no release. Associate it with the release containing its source maps.";
    case "no_artifacts":
      return "No artifacts are uploaded for this event's release.";
    default:
      return "Source code is unavailable for this frame.";
  }
}

const FrameItem = memo(function FrameItem({
  frame,
  index,
  expanded,
  onToggle,
}: {
  frame: StackFrame;
  index: number;
  expanded: boolean;
  onToggle: (index: number) => void;
}) {
  const { directory, basename } = splitPath(frame.filename);
  const badgeLabel = frame.resolved ? resolutionLabel(frame.resolution) : null;
  const location = formatFrameLocation(frame);
  // The row splits the path into flex items, which screen readers would read as separate words.
  const accessibleName = [
    frame.function ?? "<anonymous>",
    location,
    frame.inApp ? "app" : null,
    badgeLabel,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        aria-expanded={expanded}
        aria-label={accessibleName}
        className={cn(
          "group flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40 sm:items-center",
          expanded && "bg-accent/20",
        )}
        onClick={() => onToggle(index)}
        title={location}
        type="button"
      >
        <ChevronRight
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform sm:mt-0",
            expanded && "rotate-90",
          )}
        />
        <span className="grid min-w-0 flex-1 gap-0.5 font-mono text-xs sm:flex sm:items-baseline sm:gap-2">
          <span
            className={cn(
              "truncate font-medium",
              frame.inApp ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {frame.function ?? "<anonymous>"}
          </span>
          {/* Only the directory shrinks, so the file name and line stay readable; the file name
              truncates only when it alone is wider than the row. */}
          <span className="flex min-w-0 text-muted-foreground">
            <span className="min-w-0 truncate">{directory}</span>
            <span className="flex max-w-full shrink-0">
              <span className={cn("min-w-0 truncate", frame.inApp && "text-foreground")}>
                {basename}
              </span>
              <span className="shrink-0">
                :{frame.lineno}
                {frame.colno != null ? `:${frame.colno}` : ""}
              </span>
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {frame.inApp ? <Badge variant="accent">app</Badge> : null}
          {badgeLabel ? <Badge variant="muted">{badgeLabel}</Badge> : null}
          {frame.resolved === false && frame.inApp ? (
            <Badge title={frame.diagnostic ?? "Symbol resolution unavailable"} variant="warning">
              no symbols
            </Badge>
          ) : null}
        </span>
      </button>
      {expanded ? (
        frame.contextLine !== null ? (
          <div className="border-t border-border">
            <FrameSource frame={frame} />
          </div>
        ) : (
          <p className="border-t border-border bg-background/60 px-9 py-3 text-xs text-muted-foreground">
            {missingSourceMessage(frame)}
          </p>
        )
      ) : null}
    </li>
  );
});

function CollapsedFramesRow({ count, onReveal }: { count: number; onReveal: () => void }) {
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        className="flex w-full items-center gap-2 bg-muted/20 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
        onClick={onReveal}
        type="button"
      >
        <Layers className="size-3.5 shrink-0" />
        {count} library {count === 1 ? "frame" : "frames"} hidden
        <span className="text-primary-accent">Show</span>
      </button>
    </li>
  );
}

function StackFrameList({
  rows,
  expanded,
  onToggle,
  onRevealGroup,
}: {
  rows: FrameRow[];
  expanded: Set<number>;
  onToggle: (index: number) => void;
  onRevealGroup: (groupStart: number) => void;
}) {
  return (
    <ol className="min-w-0">
      {rows.map((row) =>
        row.kind === "frame" ? (
          <FrameItem
            expanded={expanded.has(row.index)}
            frame={row.frame}
            index={row.index}
            key={`frame-${row.index}`}
            onToggle={onToggle}
          />
        ) : (
          <CollapsedFramesRow
            count={row.count}
            key={`group-${row.start}`}
            onReveal={() => onRevealGroup(row.start)}
          />
        ),
      )}
    </ol>
  );
}

export { StackFrameList };
