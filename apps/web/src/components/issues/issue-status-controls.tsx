import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function IssueToneBadge({ value }: { value: string }) {
  const className =
    value === "fatal" || value === "error"
      ? "border-destructive/30 bg-destructive/10 text-red-300"
      : value === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-border bg-muted/30 text-muted-foreground";

  return <IssueBadge className={className} value={value} />;
}

function IssueStateBadge({ value }: { value: string }) {
  const className =
    value === "resolved"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : value === "ignored"
        ? "border-border bg-muted/30 text-muted-foreground"
        : "border-primary/30 bg-primary/10 text-primary-accent";

  return <IssueBadge className={className} value={value} />;
}

function IssueBadge({ value, className }: { value: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${className}`}
    >
      {value}
    </span>
  );
}

function PriorityControl({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (priority: string) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`h-8 gap-1.5 rounded-full px-2.5 text-[11px] font-medium ${priorityClass(value)}`}
          disabled={disabled}
          size="sm"
          type="button"
          variant="outline"
        >
          <Flag className="size-3.5" />
          {priorityLabel(value)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel>Set priority</DropdownMenuLabel>
        {PRIORITIES.map((priority) => (
          <DropdownMenuItem
            className={priority === value ? "bg-accent" : undefined}
            key={priority}
            onClick={() => void onChange(priority)}
          >
            <span className={`size-2 rounded-full ${priorityDotClass(priority)}`} />
            <span className="flex-1">{priorityLabel(priority)}</span>
            {priority === value ? <span className="text-primary">✓</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function priorityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function priorityClass(value: string) {
  return value === "critical"
    ? "border-rose-500/35 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
    : value === "high"
      ? "border-orange-500/35 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15"
      : value === "low"
        ? "border-slate-400/35 bg-slate-400/10 text-slate-300 hover:bg-slate-400/15"
        : "border-blue-500/35 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15";
}

function priorityDotClass(value: string) {
  return value === "critical"
    ? "bg-rose-500"
    : value === "high"
      ? "bg-orange-500"
      : value === "low"
        ? "bg-slate-400"
        : "bg-blue-500";
}

export { IssueStateBadge, IssueToneBadge, PriorityControl };
