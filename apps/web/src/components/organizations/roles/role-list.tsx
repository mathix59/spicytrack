import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import type { RoleItem } from "./types";

function RoleList({
  roles,
  selectedKey,
  onSelect,
  label,
}: {
  roles: RoleItem[];
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
  label: string;
}) {
  return (
    <ul aria-label={label} className="grid gap-1">
      {roles.map((role) => {
        const selected = role.key === selectedKey;
        return (
          <li className="min-w-0" key={role.id}>
            <button
              aria-current={selected ? "true" : undefined}
              className={cn(
                "grid w-full min-w-0 gap-1 rounded-md px-3 py-2.5 text-left transition-colors",
                selected ? "bg-accent" : "hover:bg-accent/50",
              )}
              onClick={() => onSelect(role.key)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{role.name}</span>
                {role.isSystem ? null : (
                  <Badge className="shrink-0" variant="accent">
                    Custom
                  </Badge>
                )}
                <span
                  className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular"
                  title={`${role.memberCount} member${role.memberCount === 1 ? "" : "s"}`}
                >
                  <Users aria-hidden className="size-3.5" />
                  {role.memberCount}
                  <span className="sr-only"> members</span>
                </span>
              </span>
              {role.description ? (
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {role.description}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export { RoleList };
