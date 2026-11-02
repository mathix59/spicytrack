import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5", className)}
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-background text-foreground shadow-sm",
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
        );
      })}
    </div>
  );
}

export { SegmentedControl, type SegmentedOption };
