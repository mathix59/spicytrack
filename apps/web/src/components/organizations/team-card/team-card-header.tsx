import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import type { TeamDto } from "@/generated/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function TeamCardHeader({
  team,
  expanded,
  teamMembersCount,
  teamProjectsCount,
  canManage,
  onToggleExpanded,
  onOpenAdd,
  onOpenRoles,
  onOpenEdit,
  onOpenDelete,
}: {
  team: TeamDto;
  expanded: boolean;
  teamMembersCount: number;
  teamProjectsCount: number;
  canManage: boolean;
  onToggleExpanded: () => void;
  onOpenAdd: () => void;
  onOpenRoles: () => void;
  onOpenEdit: () => void;
  onOpenDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col transition-colors hover:bg-accent/50 sm:flex-row sm:items-center",
        expanded && "border-b border-border",
      )}
    >
      <button
        aria-expanded={expanded}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={onToggleExpanded}
        type="button"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{team.name}</span>
          {team.description ? (
            <span className="block truncate text-xs text-muted-foreground">{team.description}</span>
          ) : null}
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {teamMembersCount} member{teamMembersCount === 1 ? "" : "s"} · {teamProjectsCount} project
          {teamProjectsCount === 1 ? "" : "s"}
        </span>
      </button>
      {canManage ? (
        <div className="flex shrink-0 justify-end gap-2 px-4 pb-3 sm:pr-4 sm:pb-0 sm:pl-0">
          <Button onClick={onOpenAdd} size="sm" type="button" variant="secondary">
            <Plus className="size-4" />
            Add member
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" type="button" variant="ghost">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Team actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onOpenRoles}>
                <Settings2 className="size-4" />
                Manage team roles
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenEdit}>
                <Pencil className="size-4" />
                Edit team
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenDelete}>
                <Trash2 className="size-4" />
                Delete team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

export { TeamCardHeader };
