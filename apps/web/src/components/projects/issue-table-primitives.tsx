import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

function SortHeader({
  active,
  direction,
  label,
  onClick,
  rightAligned = false,
}: {
  active?: boolean;
  direction: string;
  label: string;
  onClick: () => void;
  rightAligned?: boolean;
}) {
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      className={cn(
        "flex w-full items-center gap-1 text-xs font-medium transition hover:text-foreground",
        rightAligned ? "justify-end text-right" : "justify-start text-left",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
      <Icon className="size-3.5" />
    </button>
  );
}

function LevelDot({ value, className }: { value: string; className?: string }) {
  const color =
    value === "fatal" || value === "error"
      ? "bg-destructive"
      : value === "warning"
        ? "bg-warning"
        : value === "info"
          ? "bg-info"
          : "bg-muted-foreground";
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("inline-block size-2 shrink-0 rounded-full", color, className)}
        title={value}
      />
      <span className="sr-only">{value} level:</span>
    </>
  );
}

function initialsOf(name: string) {
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase();
}

function AssigneeAvatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        aria-label="Unassigned"
        className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
        role="img"
        title="Unassigned"
      >
        —
      </span>
    );
  }
  return (
    <span
      aria-label={`Assigned to ${name}`}
      className="inline-flex size-6 items-center justify-center rounded-full bg-primary/12 text-[10px] font-semibold text-primary-accent"
      role="img"
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

export { AssigneeAvatar, LevelDot, SortHeader };
