import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Tiny trend chart. Bars suit sparse event counts (an empty hour reads as empty), the area
 * variant suits continuous volume. It scales to its container; pass a label so screen readers
 * get a summary instead of the drawing.
 */
function Sparkline({
  values,
  variant = "bars",
  label,
  className,
  tone = "primary",
}: {
  values: number[];
  variant?: "bars" | "area";
  label: string;
  className?: string;
  tone?: "primary" | "muted" | "destructive";
}) {
  const gradientId = useId();
  const width = 100;
  const height = 32;
  const max = Math.max(1, ...values);
  const toneClass = {
    primary: "text-primary-accent",
    muted: "text-muted-foreground",
    destructive: "text-destructive",
  }[tone];

  return (
    <svg
      aria-label={label}
      className={cn("block h-8 w-full overflow-visible", toneClass, className)}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {variant === "bars" ? (
        values.map((value, index) => {
          const slot = width / Math.max(values.length, 1);
          const barHeight = value === 0 ? 1 : Math.max(2, (value / max) * height);
          return (
            <rect
              className={value === 0 ? "fill-border" : "fill-current"}
              height={barHeight}
              key={index}
              rx={0.6}
              width={Math.max(slot - 1.2, 0.8)}
              x={index * slot + 0.6}
              y={height - barHeight}
            />
          );
        })
      ) : (
        <SparkArea
          gradientId={gradientId}
          height={height}
          max={max}
          values={values}
          width={width}
        />
      )}
    </svg>
  );
}

function SparkArea({
  values,
  width,
  height,
  max,
  gradientId,
}: {
  values: number[];
  width: number;
  height: number;
  max: number;
  gradientId: string;
}) {
  if (values.length === 0) {
    return null;
  }
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values.map(
    (value, index) => [index * step, height - 2 - (value / max) * (height - 4)] as const,
  );
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

export { Sparkline };
