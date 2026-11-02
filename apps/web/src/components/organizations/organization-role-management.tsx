import { useState } from "react";
import type { FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListOrganizationRolesQueryKey,
  type OrganizationRoleDto,
  useCreateOrganizationRole,
  useDeleteOrganizationRole,
  useUpdateOrganizationRole,
} from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";
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
import { SkeletonRows } from "@/components/ui/skeleton";

import { OrganizationSectionHeader } from "./organization-section-header";
import { ORGANIZATION_PERMISSION_GROUPS } from "./roles/permission-groups";
import { RoleForm } from "./roles/role-form";
import { RolePermissionsDialog } from "./roles/role-permissions-dialog";

type QueryStatus = { isLoading: boolean; error: unknown; refetch: () => void };

function roleKeyFromName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function OrganizationRoleManagement({
  orgSlug,
  roles,
  status,
  canManage,
}: {
  orgSlug: string;
  roles: OrganizationRoleDto[];
  status?: QueryStatus;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<OrganizationRoleDto | null>(null);
  const [detailsRole, setDetailsRole] = useState<OrganizationRoleDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateOrganizationRole();
  const updateMutation = useUpdateOrganizationRole();
  const deleteMutation = useDeleteOrganizationRole();
  const refresh = () =>
    invalidateQueryKeys(queryClient, [getListOrganizationRolesQueryKey(orgSlug)]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const permissions = data.getAll("permissions").map(String);
    setError(null);
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          orgSlug,
          roleKey: editing.key,
          data: { name, permissions },
        });
        setEditing(null);
        toast.success("Organization role updated");
      } else {
        await createMutation.mutateAsync({
          orgSlug,
          data: { key: roleKeyFromName(name), name, permissions },
        });
        setCreateOpen(false);
        toast.success("Organization role created");
      }
      await refresh();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const remove = async (role: OrganizationRoleDto) => {
    await deleteMutation.mutateAsync({ orgSlug, roleKey: role.key });
    await refresh();
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
        count={status?.isLoading ? undefined : roles.length}
        description="Organization roles can grant access across the whole organization. Team roles scope project access to one team."
        title="Organization roles"
      />
      <CardContent>
        {status?.isLoading ? (
          <SkeletonRows rows={3} />
        ) : status?.error ? (
          <QueryError
            error={status.error}
            onRetry={status.refetch}
            title="Could not load organization roles"
          />
        ) : (
          <div className="grid gap-3">
            {roles.map((role) => (
              <div
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                key={role.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{role.name}</p>
                    {role.isSystem ? <Badge variant="muted">Built-in</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Button onClick={() => setDetailsRole(role)} size="sm" variant="outline">
                    View permissions
                  </Button>
                  {canManage && !role.isSystem ? (
                    <>
                      <Button
                        aria-label={`Edit ${role.name}`}
                        onClick={() => {
                          setError(null);
                          setEditing(role);
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDialog
                        confirmLabel="Delete role"
                        description="Members using this role must be reassigned first."
                        onConfirm={() => remove(role)}
                        successMessage="Organization role deleted"
                        title={`Delete ${role.name}?`}
                        trigger={
                          <Button aria-label={`Delete ${role.name}`} size="icon-sm" variant="ghost">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <RolePermissionsDialog
        groups={ORGANIZATION_PERMISSION_GROUPS}
        onClose={() => setDetailsRole(null)}
        role={detailsRole}
      />
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New organization role</DialogTitle>
            <DialogDescription>
              Grant permissions across the whole organization and all of its projects.
            </DialogDescription>
          </DialogHeader>
          <RoleForm
            error={error}
            groups={ORGANIZATION_PERMISSION_GROUPS}
            isPending={createMutation.isPending}
            nameLabel="Organization role name"
            onSubmit={submit}
            permissionsLegend="Organization and project permissions"
            showKeys
            submitLabel="Create role"
          />
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setEditing(null)} open={Boolean(editing)}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>Update this custom organization role.</DialogDescription>
          </DialogHeader>
          <RoleForm
            error={error}
            groups={ORGANIZATION_PERMISSION_GROUPS}
            isPending={updateMutation.isPending}
            key={editing?.id}
            nameLabel="Organization role name"
            onSubmit={submit}
            permissionsLegend="Organization and project permissions"
            role={editing}
            showKeys
            submitLabel="Save changes"
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export { OrganizationRoleManagement };
