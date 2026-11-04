import { useState } from "react";
import { Shield, UserRound } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatLocalDate } from "@/lib/utils";

import { DeleteUserDialog } from "./delete-user-dialog";
import type { InstanceUser } from "./types";

/** Why the super-admin switch is locked for this row, or null when it can be changed. */
function roleLockReason({
  isCurrentUser,
  isLastSuperAdmin,
}: {
  isCurrentUser: boolean;
  isLastSuperAdmin: boolean;
}) {
  if (isCurrentUser) {
    return "You can't change your own access. Ask another administrator.";
  }
  if (isLastSuperAdmin) {
    return "The instance needs at least one super-admin. Grant access to someone else first.";
  }
  return null;
}

function InstanceUserRow({
  user,
  isCurrentUser,
  isLastSuperAdmin,
  onChangeRole,
  onDelete,
}: {
  user: InstanceUser;
  isCurrentUser: boolean;
  isLastSuperAdmin: boolean;
  onChangeRole: (userId: string, isSuperAdmin: boolean) => Promise<void>;
  onDelete: (userId: string, confirmationEmail: string) => Promise<void>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [grant, setGrant] = useState(!user.isSuperAdmin);
  const lockReason = roleLockReason({ isCurrentUser, isLastSuperAdmin });
  const lockReasonId = `instance-user-${user.id}-role-lock`;

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
          <UserRound className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium">{user.name || user.email}</p>
            {isCurrentUser ? <Badge variant="muted">You</Badge> : null}
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
      <div className="grid min-w-0 gap-1 sm:justify-items-end">
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Super-admin
            <Switch
              aria-describedby={lockReason ? lockReasonId : undefined}
              aria-label={`Super-admin access for ${user.email}`}
              checked={user.isSuperAdmin}
              disabled={lockReason !== null}
              onCheckedChange={(next) => {
                setGrant(next);
                setConfirmOpen(true);
              }}
            />
          </label>
          {isCurrentUser ? null : <DeleteUserDialog onDelete={onDelete} user={user} />}
        </div>
        {lockReason ? (
          <p className="text-xs text-muted-foreground sm:text-right" id={lockReasonId}>
            {lockReason}
          </p>
        ) : null}
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
