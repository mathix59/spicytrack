import type { ReactNode } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import type { PermissionGroup } from "./permission-groups";
import { RolePermissionSummary } from "./role-permission-summary";
import type { RoleItem, RoleMember } from "./types";

const VISIBLE_MEMBERS = 8;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function initials(value: string) {
  return (
    value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "?"
  );
}

function deleteBlocker(role: RoleItem) {
  const pending = role.pendingInvitationCount ?? 0;
  if (role.memberCount > 0) {
    return `Reassign the ${plural(role.memberCount, "member")} using this role before deleting it.`;
  }
  if (pending > 0) {
    return `Revoke the ${plural(pending, "pending invitation")} for this role before deleting it.`;
  }
  return null;
}

function RoleMembers({
  members,
  total,
  membersHref,
}: {
  members: RoleMember[] | undefined;
  total: number;
  membersHref?: string;
}) {
  if (members === undefined) {
    return (
      <div aria-busy="true" aria-label="Loading members" className="grid gap-2">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    );
  }
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No one has this role yet.</p>;
  }
  const hidden = Math.max(0, total - VISIBLE_MEMBERS);
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1 sm:grid-cols-2">
        {members.slice(0, VISIBLE_MEMBERS).map((member) => (
          <li className="flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5" key={member.id}>
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-2xs font-medium text-muted-foreground"
            >
              {initials(member.name || member.email)}
            </span>
            <span className="grid min-w-0">
              <span className="truncate text-sm">{member.name || member.email}</span>
              {member.name ? (
                <span className="truncate text-xs text-muted-foreground">{member.email}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        membersHref ? (
          <Link className="text-sm text-primary-accent hover:underline" to={membersHref}>
            and {plural(hidden, "more member")}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">and {plural(hidden, "more member")}</p>
        )
      ) : null}
    </div>
  );
}

function RoleDetail({
  role,
  groups,
  members,
  membersHref,
  canManage,
  onEdit,
  onDuplicate,
  onDelete,
  extraActions,
}: {
  role: RoleItem;
  groups: PermissionGroup[];
  /** Members holding this role; undefined while loading. */
  members: RoleMember[] | undefined;
  membersHref?: string;
  canManage: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => Promise<unknown>;
  extraActions?: ReactNode;
}) {
  const known = groups.flatMap((group) => group.permissions);
  const grantedCount = known.filter((permission) =>
    role.permissions.includes(permission.value),
  ).length;
  const blocker = deleteBlocker(role);
  const pending = role.pendingInvitationCount ?? 0;

  return (
    <Card aria-label={`${role.name} role`} className="min-w-0" role="region">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight">{role.name}</h3>
              {role.isSystem ? (
                <Badge variant="muted">Built-in</Badge>
              ) : (
                <Badge variant="accent">Custom</Badge>
              )}
            </div>
            <p className="max-w-prose text-sm text-muted-foreground">
              {role.description ||
                (role.isSystem
                  ? "Built-in role."
                  : "No description yet. Edit the role to add one.")}
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={onDuplicate} size="sm" type="button" variant="outline">
                <Copy />
                Duplicate
              </Button>
              {extraActions}
              {role.isSystem ? null : (
                <>
                  <Button onClick={onEdit} size="sm" type="button" variant="outline">
                    <Pencil />
                    Edit
                  </Button>
                  <ConfirmDialog
                    confirmLabel="Delete role"
                    description="The role is removed permanently. This cannot be undone."
                    onConfirm={onDelete}
                    successMessage={`${role.name} deleted`}
                    title={`Delete ${role.name}?`}
                    trigger={
                      <Button
                        aria-label={`Delete ${role.name}`}
                        disabled={blocker !== null}
                        size="icon-sm"
                        title={blocker ?? undefined}
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Members</dt>
            <dd className="font-medium tabular">{role.memberCount}</dd>
          </div>
          {pending > 0 ? (
            <div className="flex gap-1.5">
              <dt className="text-muted-foreground">Pending invitations</dt>
              <dd className="font-medium tabular">{pending}</dd>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Permissions</dt>
            <dd className="font-medium tabular">
              {grantedCount} of {known.length}
            </dd>
          </div>
        </dl>
        {canManage && !role.isSystem && blocker ? (
          <p className="text-xs text-muted-foreground">{blocker}</p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-6">
        <section aria-labelledby={`role-${role.id}-members`} className="grid gap-2">
          <h4 className="text-sm font-medium" id={`role-${role.id}-members`}>
            Members with this role
          </h4>
          <RoleMembers members={members} membersHref={membersHref} total={role.memberCount} />
        </section>
        <Separator />
        <section aria-labelledby={`role-${role.id}-permissions`} className="grid gap-3">
          <h4 className="text-sm font-medium" id={`role-${role.id}-permissions`}>
            What this role can do
          </h4>
          <RolePermissionSummary groups={groups} permissions={role.permissions} />
        </section>
      </CardContent>
    </Card>
  );
}

export { RoleDetail };
