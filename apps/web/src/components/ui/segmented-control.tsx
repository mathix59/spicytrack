import { cn } from "@/lib/utils";

import { tabsListVariants, tabsTriggerVariants } from "./tabs.styles";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

/**
 * Toggle between views of the same content (inbox presets, App / Full frames). Shares the
 * segmented tab look; `value` may be null when the current view matches no option.
 */
function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  fullWidth = false,
}: {
  value: T | null;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  /** Stretch across the container with equal segments at the regular text size. */
  fullWidth?: boolean;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        tabsListVariants({ variant: "segmented" }),
        fullWidth && "flex w-full",
        className,
      )}
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={option.value === value}
          className={cn(
            tabsTriggerVariants({ variant: "segmented" }),
            fullWidth ? "h-8 flex-1" : "gap-1.5 px-2.5 text-xs",
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
          {option.count !== undefined ? (
            <span className="tabular-nums text-muted-foreground">{option.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export { SegmentedControl, type SegmentedOption };
