import { useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListOrganizationRolesQueryKey,
  type OrganizationRoleDto,
  useCreateOrganizationRole,
  useDeleteOrganizationRole,
  useUpdateOrganizationRole,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";
import { OrganizationSectionHeader } from "./organization-section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const ORGANIZATION_PERMISSIONS = [
  "org.read",
  "org.members.read",
  "org.members.invite",
  "org.members.update_role",
  "org.members.remove",
  "org.teams.read",
  "org.teams.create",
  "org.teams.update",
  "org.teams.delete",
  "org.projects.read",
  "org.projects.create",
  "org.projects.update",
  "org.settings.manage",
  "org.mcp.manage",
  "audit.read",
  "project.read",
  "project.issues.read",
  "project.issues.manage",
  "project.events.read",
  "project.releases.read",
  "project.releases.manage",
  "project.artifacts.read",
  "project.artifacts.manage",
  "project.alerts.read",
  "project.alerts.manage",
  "project.keys.read",
  "project.keys.manage",
  "project.integrations.read",
  "project.integrations.manage",
  "project.autofix.read",
  "project.autofix.run",
  "project.autofix.manage",
] as const;

function OrganizationRoleManagement({
  orgSlug,
  roles,
  canManage,
}: {
  orgSlug: string;
  roles: OrganizationRoleDto[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<OrganizationRoleDto | null>(null);
  const [detailsRole, setDetailsRole] = useState<OrganizationRoleDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<OrganizationRoleDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateOrganizationRole();
  const updateMutation = useUpdateOrganizationRole();
  const deleteMutation = useDeleteOrganizationRole();
  const refresh = () =>
    invalidateQueryKeys(queryClient, [getListOrganizationRolesQueryKey(orgSlug)]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const permissions = data.getAll("permissions").map(String);
    setError(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          orgSlug,
          roleKey: editing.key,
          data: { name: String(data.get("name") ?? ""), permissions },
        });
        setEditing(null);
      } else {
        const name = String(data.get("name") ?? "").trim();
        await createMutation.mutateAsync({
          orgSlug,
          data: {
            key: name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
            name,
            permissions,
          },
        });
        setCreateOpen(false);
      }
      await refresh();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync({ orgSlug, roleKey: deleting.key });
      await refresh();
      setDeleting(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return (
    <Card>
      <OrganizationSectionHeader
        action={
          canManage ? (
            <Button
              onClick={() => {
                setError(null);
                setCreateOpen(true);
              }}
              size="sm"
            >
              <Plus className="size-4" />
              New organization role
            </Button>
          ) : null
        }
        count={roles.length}
        description="Organization roles can grant access across the whole organization. Team roles scope project access to one team."
        title="Organization roles"
      />
      <CardContent>
        <div className="grid gap-3">
          {roles.map((role) => (
            <div className="rounded-lg border border-border p-4" key={role.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex w-full items-start justify-between gap-3">
                    <p className="font-medium">{role.name}</p>
                    <div className="flex items-start gap-2">
                      <Button onClick={() => setDetailsRole(role)} size="sm" variant="outline">
                        View permissions
                      </Button>
                      {canManage && !role.isSystem ? (
                        <div className="flex gap-1">
                          <Button
                            aria-label={`Edit ${role.name}`}
                            onClick={() => setEditing(role)}
                            size="sm"
                            variant="ghost"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            aria-label={`Delete ${role.name}`}
                            onClick={() => setDeleting(role)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <Badge className="mt-2" variant="muted">
                    {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <Dialog onOpenChange={(open) => !open && setDetailsRole(null)} open={Boolean(detailsRole)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detailsRole?.name} permissions</DialogTitle>
            <DialogDescription>Permissions granted by this organization role.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">
            {detailsRole?.permissions.map((permission) => (
              <Badge key={permission} variant="accent">
                {permission.replaceAll(".", " ")}
              </Badge>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setCreateOpen(false)} open={createOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New organization role</DialogTitle>
            <DialogDescription>
              Grant permissions across the whole organization and all of its projects.
            </DialogDescription>
          </DialogHeader>
          <RoleForm error={error} onSubmit={submit} pending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setEditing(null)} open={Boolean(editing)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>Update this custom organization role.</DialogDescription>
          </DialogHeader>
          <RoleForm
            error={error}
            onSubmit={submit}
            pending={updateMutation.isPending}
            role={editing}
          />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setDeleting(null)} open={Boolean(deleting)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>Members using this role must be reassigned first.</DialogDescription>
          </DialogHeader>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeleting(null)} variant="outline">
              Cancel
            </Button>
            <Button disabled={deleteMutation.isPending} onClick={() => void remove()}>
              Delete role
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RoleForm({
  role,
  error,
  pending,
  onSubmit,
}: {
  role?: OrganizationRoleDto | null;
  error: string | null;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field label="Organization role name">
        <Input defaultValue={role?.name} name="name" required />
      </Field>
      <Field label="Organization and project permissions">
        <div className="grid gap-2 sm:grid-cols-2">
          {ORGANIZATION_PERMISSIONS.map((permission) => (
            <label
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              key={permission}
            >
              <input
                defaultChecked={role?.permissions.includes(permission)}
                name="permissions"
                type="checkbox"
                value={permission}
              />
              <span>{permission}</span>
            </label>
          ))}
        </div>
      </Field>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button disabled={pending} type="submit">
        {role ? "Save changes" : "Create role"}
      </Button>
    </form>
  );
}

export { OrganizationRoleManagement };
