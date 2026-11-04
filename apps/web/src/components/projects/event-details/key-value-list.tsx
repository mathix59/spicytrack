import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PayloadRecord } from "./types";
import { displayValue, formatLabel } from "./utils";

const PREVIEW_LIMIT = 12;

function KeyValueList({ value, className }: { value: PayloadRecord; className?: string }) {
  return (
    <dl
      className={cn(
        "grid min-w-0 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[minmax(7rem,0.35fr)_minmax(0,1fr)]",
        className,
      )}
    >
      {Object.entries(value).map(([key, fieldValue]) => (
        <div className="contents" key={key}>
          <dt className="min-w-0 truncate text-muted-foreground" title={key}>
            {formatLabel(key)}
          </dt>
          <dd className="min-w-0 font-mono text-foreground [overflow-wrap:anywhere]">
            {displayValue(fieldValue)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ShowMoreButton({
  expanded,
  hiddenCount,
  onToggle,
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  return (
    <Button
      className="w-full rounded-none"
      onClick={onToggle}
      size="sm"
      type="button"
      variant="ghost"
    >
      {expanded ? "Show less" : `Show ${hiddenCount} more`}
    </Button>
  );
}

export { KeyValueList, PREVIEW_LIMIT, ShowMoreButton };
