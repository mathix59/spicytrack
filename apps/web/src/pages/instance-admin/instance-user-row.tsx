import { useState } from "react";
import { Shield, UserRound } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatLocalDate } from "@/lib/utils";

import { DeleteUserDialog } from "./delete-user-dialog";
import type { InstanceUser } from "./types";

function InstanceUserRow({
  user,
  onChangeRole,
  onDelete,
}: {
  user: InstanceUser;
  onChangeRole: (userId: string, isSuperAdmin: boolean) => Promise<void>;
  onDelete: (userId: string, confirmationEmail: string) => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [grant, setGrant] = useState(!user.isSuperAdmin);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
          <UserRound className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{user.name || user.email}</p>
            {user.isSuperAdmin ? (
              <Badge variant="accent">
                <Shield />
                Super-admin
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">Joined {formatLocalDate(user.createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Super-admin
          <Switch
            aria-label={`Super-admin access for ${user.email}`}
            checked={user.isSuperAdmin}
            onCheckedChange={(next) => {
              setGrant(next);
              setConfirmOpen(true);
            }}
          />
        </label>
        <DeleteUserDialog onDelete={onDelete} user={user} />
      </div>
      <ConfirmDialog
        confirmLabel={grant ? "Grant access" : "Revoke access"}
        description={
          grant
            ? `${user.email} will be able to change instance settings, manage every user and delete accounts.`
            : `${user.email} will lose access to instance administration.`
        }
        destructive={!grant}
        onConfirm={() => onChangeRole(user.id, grant)}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        successMessage={grant ? "Super-admin access granted" : "Super-admin access revoked"}
        title={grant ? "Grant super-admin access?" : "Revoke super-admin access?"}
      />
    </li>
  );
}

export { InstanceUserRow };
