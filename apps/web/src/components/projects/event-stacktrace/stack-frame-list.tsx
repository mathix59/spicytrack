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
                hasContext ? "transition-colors hover:bg-accent/50" : "cursor-default",
                !frame.inApp && "opacity-60",
              )}
              onClick={hasContext ? () => onToggle(index) : undefined}
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
