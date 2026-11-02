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
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : value === "warning"
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-border bg-muted/30 text-muted-foreground";

  return <IssueBadge className={className} value={value} />;
}

function IssueStateBadge({ value }: { value: string }) {
  const className =
    value === "resolved"
      ? "border-success/30 bg-success/10 text-success"
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
    ? "border-destructive/35 bg-destructive/10 text-destructive hover:bg-destructive/15"
    : value === "high"
      ? "border-warning/35 bg-warning/10 text-warning hover:bg-warning/15"
      : value === "low"
        ? "border-muted-foreground/35 bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/15"
        : "border-info/35 bg-info/10 text-info hover:bg-info/15";
}

function priorityDotClass(value: string) {
  return value === "critical"
    ? "bg-destructive"
    : value === "high"
      ? "bg-warning"
      : value === "low"
        ? "bg-muted-foreground"
        : "bg-info";
}

export { IssueStateBadge, IssueToneBadge, PriorityControl };
