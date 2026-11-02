import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { PermissionGroup } from "./permission-groups";

/** Read-only view of a role's permissions, grouped like the permission picker. */
function RolePermissionsDialog({
  role,
  groups,
  onClose,
}: {
  role: { name: string; permissions: string[] } | null;
  groups: PermissionGroup[];
  onClose: () => void;
}) {
  const granted = new Set(role?.permissions ?? []);
  const known = new Set(groups.flatMap((group) => group.permissions.map((entry) => entry.value)));
  const ungrouped = role?.permissions.filter((permission) => !known.has(permission)) ?? [];

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(role)}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role?.name} permissions</DialogTitle>
          <DialogDescription>Permissions granted by this organization role.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {groups.map((group) => {
            const entries = group.permissions.filter((permission) => granted.has(permission.value));
            if (entries.length === 0) return null;
            return (
              <div className="grid gap-1.5" key={group.id}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {entries.map((permission) => (
                    <Badge key={permission.value} variant="accent">
                      {permission.label}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
          {ungrouped.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {ungrouped.map((permission) => (
                <Badge key={permission} variant="muted">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : null}
          {granted.size === 0 ? (
            <p className="text-sm text-muted-foreground">This role grants no permissions.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { RolePermissionsDialog };
