import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

function InboxPresetChip({
  active,
  label,
  onClick,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

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
        ? "bg-amber-500"
        : value === "info"
          ? "bg-sky-500"
          : "bg-muted-foreground";
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", color, className)}
      title={value}
    />
  );
}

function AssigneeAvatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        className="inline-flex size-6 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
        title="Unassigned"
      >
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
      title={name}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function IssueStateBadge({ value }: { value: string }) {
  const className =
    value === "resolved"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : value === "ignored"
        ? "border-border bg-muted/30 text-muted-foreground"
        : "border-primary/30 bg-primary/10 text-primary";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${className}`}
    >
      {value}
    </span>
  );
}

export { AssigneeAvatar, InboxPresetChip, IssueStateBadge, LevelDot, SortHeader };
