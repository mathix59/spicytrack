import { useState } from "react";

import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Rounds the axis maximum up to a readable step (1, 2, 5 × 10ⁿ). */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/**
 * Daily event volume as an accessible bar chart: the drawing is decorative, the numbers are
 * exposed through a visually hidden table, and each bar reveals its value on hover or focus.
 */
function EventVolumeChart({
  counts,
  endDate,
  label,
  className,
}: {
  /** Daily counts, oldest first, ending with the current UTC day. */
  counts: number[];
  endDate?: Date;
  label: string;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [renderedAt] = useState(() => new Date());
  const lastDay = endDate ?? renderedAt;
  const max = niceMax(Math.max(0, ...counts));
  const days = counts.map((count, index) => ({
    count,
    date: new Date(lastDay.getTime() - (counts.length - 1 - index) * DAY_MS),
  }));
  const active = activeIndex === null ? null : days[activeIndex];
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <figure className={cn("grid gap-3", className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
          {active
            ? `${dayFormatter.format(active.date)} · ${active.count.toLocaleString()} events`
            : `${total.toLocaleString()} events`}
        </span>
      </figcaption>

      <div aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div className="flex h-36 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums">
          <span>{max.toLocaleString()}</span>
          <span>{(max / 2).toLocaleString()}</span>
          <span>0</span>
        </div>
        <div className="relative h-36">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-border" />
          </div>
          <div
            className="relative flex h-full items-end gap-[3px]"
            onMouseLeave={() => setActiveIndex(null)}
          >
            {days.map((day, index) => (
              <div
                className="group flex h-full flex-1 items-end"
                key={day.date.toISOString()}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <div
                  className={cn(
                    "w-full rounded-t-[3px] bg-primary-accent/70 transition-[background-color,height] duration-300 ease-out group-hover:bg-primary-accent",
                    day.count === 0 && "bg-border",
                    activeIndex === index && "bg-primary-accent",
                  )}
                  style={{
                    height: day.count === 0 ? 2 : `${Math.max(3, (day.count / max) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>{days[0] ? dayFormatter.format(days[0].date) : null}</span>
          <span>{days.length > 1 ? "Today" : null}</span>
        </div>
      </div>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Events</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date.toISOString()}>
              <td>{dayFormatter.format(day.date)}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export { EventVolumeChart };
