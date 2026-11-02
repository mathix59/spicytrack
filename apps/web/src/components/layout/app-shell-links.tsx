import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

function ShellLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
      to={to}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-primary-accent")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export { ShellLink };
