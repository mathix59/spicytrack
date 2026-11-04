import { useState } from "react";

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

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/**
 * Sessions per hour or day, stacked by outcome. The drawing is decorative; the numbers are in
 * a visually hidden table, and hovering a bar shows its breakdown.
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const formatter = interval === "hour" ? hourFormatter : dayFormatter;
  const bars = points.map((point) => ({
    ...point,
    healthy: Math.max(0, point.sessions - point.errored - point.abnormal - point.crashed),
    date: new Date(point.start),
  }));
  const max = niceMax(Math.max(0, ...bars.map((bar) => bar.sessions)));
  const active = activeIndex === null ? null : bars[activeIndex];

  return (
    <figure className={cn("grid gap-3", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{label}</span>
        <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
          {active
            ? `${formatter.format(active.date)} · ${active.sessions.toLocaleString()} sessions, ${active.crashed.toLocaleString()} crashed`
            : `${bars.reduce((sum, bar) => sum + bar.sessions, 0).toLocaleString()} sessions`}
        </span>
      </figcaption>

      <div aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        <div className="flex h-32 flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums">
          <span>{max.toLocaleString()}</span>
          <span>{(max / 2).toLocaleString()}</span>
          <span>0</span>
        </div>
        <div className="relative h-32">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-dashed border-border" />
            <span className="border-t border-border" />
          </div>
          <div
            className="relative flex h-full items-end gap-[2px]"
            onMouseLeave={() => setActiveIndex(null)}
          >
            {bars.map((bar, index) => (
              <div
                className={cn(
                  "flex h-full flex-1 flex-col justify-end",
                  activeIndex !== null && activeIndex !== index && "opacity-60",
                )}
                key={bar.start}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {bar.sessions === 0 ? (
                  <div className="h-[2px] w-full bg-border" />
                ) : (
                  <div
                    className="flex w-full flex-col overflow-hidden rounded-t-[3px]"
                    style={{ height: `${Math.max(3, (bar.sessions / max) * 100)}%` }}
                  >
                    {SEGMENTS.map((segment) =>
                      bar[segment.key] > 0 ? (
                        <div
                          className={segment.className}
                          key={segment.key}
                          style={{ flexGrow: bar[segment.key], minHeight: 2 }}
                        />
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <span />
        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
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
