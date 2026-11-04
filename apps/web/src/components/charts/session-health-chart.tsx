import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

type SessionHealthPoint = {
  start: string;
  sessions: number;
  errored: number;
  abnormal: number;
  crashed: number;
};

const SEGMENTS = [
  { key: "crashed", label: "Crashed", className: "bg-destructive" },
  { key: "abnormal", label: "Abnormal", className: "bg-info/70" },
  { key: "errored", label: "Errored", className: "bg-warning/70" },
  { key: "healthy", label: "Healthy", className: "bg-success/60" },
] as const;

const hourFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const CHART_HEIGHT_PX = 128;
/** A single crash must stay visible next to thousands of healthy sessions. */
const MIN_SEGMENT_PX = { crashed: 4, abnormal: 2, errored: 2, healthy: 2 } as const;

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** Pixel height of a bar: proportional, but tall enough for each outcome it contains. */
function barHeight(
  bar: Record<(typeof SEGMENTS)[number]["key"], number>,
  sessions: number,
  max: number,
) {
  const minimum = SEGMENTS.reduce(
    (sum, segment) => sum + (bar[segment.key] > 0 ? MIN_SEGMENT_PX[segment.key] : 0),
    0,
  );
  return Math.min(CHART_HEIGHT_PX, Math.max(3, minimum, (sessions / max) * CHART_HEIGHT_PX));
}

/**
 * Sessions per hour or day, stacked by outcome. Each bar is a button: hovering, focusing or
 * tapping it shows its breakdown in the caption, and arrow keys move between bars. The numbers
 * are also in a visually hidden table.
 */
function SessionHealthChart({
  points,
  interval,
  label,
  className,
}: {
  points: SessionHealthPoint[];
  interval: "hour" | "day";
  label: string;
  className?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const barRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const formatter = interval === "hour" ? hourFormatter : dayFormatter;
  const bars = points.map((point) => ({
    ...point,
    healthy: Math.max(0, point.sessions - point.errored - point.abnormal - point.crashed),
    date: new Date(point.start),
  }));
  const max = niceMax(Math.max(0, ...bars.map((bar) => bar.sessions)));
  const activeIndex = hoverIndex ?? selectedIndex;
  const active = activeIndex === null ? null : bars[activeIndex];
  // One tab stop for the whole chart; arrow keys move between bars.
  const focusableIndex = selectedIndex ?? bars.length - 1;

  const describe = (bar: (typeof bars)[number]) =>
    `${formatter.format(bar.date)} · ${bar.sessions.toLocaleString()} sessions, ${bar.crashed.toLocaleString()} crashed`;

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(bars.length - 1, index));
    setSelectedIndex(next);
    barRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: bars.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      moveTo(moves[event.key]);
    } else if (event.key === "Escape") {
      setSelectedIndex(null);
    }
  };

  return (
    <figure className={cn("grid gap-3", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{label}</span>
        <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
          {active
            ? describe(active)
            : `${bars.reduce((sum, bar) => sum + bar.sessions, 0).toLocaleString()} sessions`}
        </span>
      </figcaption>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div
          aria-hidden="true"
          className="flex h-32 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums"
        >
          <span>{max.toLocaleString()}</span>
          <span>{(max / 2).toLocaleString()}</span>
          <span>0</span>
        </div>
        <div className="relative h-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex flex-col justify-between"
          >
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-border" />
          </div>
          <div
            aria-label={`${label}, one bar per ${interval}`}
            className="relative flex h-full items-end gap-[2px]"
            onMouseLeave={() => setHoverIndex(null)}
            role="group"
          >
            {bars.map((bar, index) => (
              <button
                aria-label={describe(bar)}
                aria-pressed={selectedIndex === index}
                className={cn(
                  "flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-end rounded-t-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeIndex !== null && activeIndex !== index && "opacity-60",
                )}
                key={bar.start}
                onClick={() => setSelectedIndex(index)}
                onFocus={() => setSelectedIndex(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                onMouseEnter={() => setHoverIndex(index)}
                ref={(element) => {
                  barRefs.current[index] = element;
                }}
                tabIndex={index === focusableIndex ? 0 : -1}
                type="button"
              >
                {bar.sessions === 0 ? (
                  <span className="block h-[2px] w-full bg-border" />
                ) : (
                  <span
                    className="flex w-full flex-col overflow-hidden rounded-t-[3px]"
                    style={{ height: barHeight(bar, bar.sessions, max) }}
                  >
                    {SEGMENTS.map((segment) =>
                      bar[segment.key] > 0 ? (
                        <span
                          className={cn("block", segment.className)}
                          key={segment.key}
                          style={{
                            flexGrow: bar[segment.key],
                            flexBasis: 0,
                            minHeight: MIN_SEGMENT_PX[segment.key],
                          }}
                        />
                      ) : null,
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <span />
        <div
          aria-hidden="true"
          className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"
        >
          <span>{bars[0] ? formatter.format(bars[0].date) : null}</span>
          <span>{interval === "hour" ? "Now" : "Today"}</span>
        </div>
      </div>

      <ul
        aria-hidden="true"
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
      >
        {[...SEGMENTS].reverse().map((segment) => (
          <li className="flex items-center gap-1.5" key={segment.key}>
            <span className={cn("size-2.5 rounded-sm", segment.className)} />
            {segment.label}
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{interval === "hour" ? "Hour" : "Day"}</th>
            <th scope="col">Sessions</th>
            <th scope="col">Errored</th>
            <th scope="col">Abnormal</th>
            <th scope="col">Crashed</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.start}>
              <td>{formatter.format(bar.date)}</td>
              <td>{bar.sessions}</td>
              <td>{bar.errored}</td>
              <td>{bar.abnormal}</td>
              <td>{bar.crashed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export { SessionHealthChart };
