import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { CodeLine } from "./code-line";
import type { StackFrame } from "./types";

function StackFrameList({
  frames,
  expanded,
  onToggle,
}: {
  frames: StackFrame[];
  expanded: Set<number>;
  onToggle: (index: number) => void;
}) {
  const resolutionLabel = (resolution: StackFrame["resolution"]) => {
    if (resolution === "sourcemap") return "source map";
    if (resolution === "proguard") return "deobfuscated";
    if (resolution === "dart_obfuscation") return "deobfuscated";
    return null;
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Stack trace
        <span className="ml-2 normal-case tracking-normal">most recent call first</span>
      </div>
      {!frames.some(
        (frame) => frame.inApp && (frame.resolved !== false || frame.contextLine !== null),
      ) && (
        <p className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
          No application source could be resolved in this stack. Check the release artifacts and
          captured frames; source maps cannot recover calls absent from the event.
        </p>
      )}
      {frames.map((frame, index) => {
        const hasContext = frame.contextLine !== null;
        const isExpanded = expanded.has(index);
        const badgeLabel = frame.resolved ? resolutionLabel(frame.resolution) : null;

        return (
          <div
            className={cn("border-b border-border last:border-b-0")}
            key={`${frame.filename}:${frame.lineno}:${index}`}
          >
            <button
              className={cn(
                "flex w-full items-center gap-2 px-4 py-2 text-left text-sm",
                "transition-colors hover:bg-accent/50",
                !frame.inApp && "opacity-60",
              )}
              onClick={() => onToggle(index)}
              aria-expanded={isExpanded}
              title={`${frame.filename}:${frame.lineno}:${frame.colno ?? 0}`}
              type="button"
            >
              {hasContext ? (
                isExpanded ? (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                <span className="text-foreground">{frame.filename}</span>
                {frame.function ? (
                  <span className="text-muted-foreground">
                    {" in "}
                    <span className="text-foreground">{frame.function}</span>
                  </span>
                ) : null}
                <span className="text-muted-foreground">
                  {" at line "}
                  {frame.lineno}
                  {frame.colno != null ? `:${frame.colno}` : ""}
                </span>
              </span>
              {!frame.inApp ? <Badge variant="muted">library</Badge> : null}
              {badgeLabel ? <Badge variant="accent">{badgeLabel}</Badge> : null}
              {frame.resolved === false && frame.inApp ? (
                <Badge title={frame.diagnostic ?? "Symbol resolution unavailable"} variant="muted">
                  no symbols
                </Badge>
              ) : null}
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                <p className="font-mono">
                  {frame.filename}
                  {frame.function ? ` in ${frame.function}` : ""} at line {frame.lineno}
                  {frame.colno != null ? `:${frame.colno}` : ""}
                </p>
                {!hasContext && (
                  <p className="mt-2">
                    {frame.resolution === "sourcemap" && frame.resolved
                      ? "Location resolved, but this source map does not include the original source text."
                      : frame.diagnostic === "artifact_not_found"
                        ? "No uploaded artifact matches this script in the event's release. It may be an external or injected script."
                        : frame.diagnostic === "no_release"
                          ? "This event has no release. Associate it with the release containing its source maps."
                          : frame.diagnostic === "no_artifacts"
                            ? "No artifacts are uploaded for this event's release."
                            : "Source code is unavailable for this frame."}
                  </p>
                )}
              </div>
            )}
            {hasContext && isExpanded ? (
              <div className="overflow-x-auto border-t border-border bg-muted/20 font-mono text-[13px] leading-6">
                {frame.preContext.map((line, lineIndex) => (
                  <CodeLine
                    key={`pre-${lineIndex}`}
                    lineno={frame.lineno - frame.preContext.length + lineIndex}
                    text={line}
                  />
                ))}
                <CodeLine highlighted lineno={frame.lineno} text={frame.contextLine ?? ""} />
                {frame.postContext.map((line, lineIndex) => (
                  <CodeLine
                    key={`post-${lineIndex}`}
                    lineno={frame.lineno + 1 + lineIndex}
                    text={line}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export { StackFrameList };
