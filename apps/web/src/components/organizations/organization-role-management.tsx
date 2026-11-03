import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListOrganizationRolesQueryKey,
  type OrganizationMemberDto,
  type OrganizationRoleDto,
  useCreateOrganizationRole,
  useDeleteOrganizationRole,
  useUpdateOrganizationRole,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ORGANIZATION_PERMISSION_GROUPS } from "./roles/permission-groups";
import { RoleForm } from "./roles/role-form";
import { RoleWorkspace } from "./roles/role-workspace";
import type { RoleFormValues, RoleItem } from "./roles/types";

type QueryStatus = { isLoading: boolean; error: unknown; refetch: () => void };

type DialogState =
  | { mode: "create"; startFrom?: RoleItem }
  | { mode: "edit"; role: RoleItem }
  | null;

function roleKeyFromName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

function OrganizationRoleManagement({
  orgSlug,
  roles,
  status,
  members,
  membersStatus,
  canManage,
}: {
  orgSlug: string;
  roles: OrganizationRoleDto[];
  status: QueryStatus;
  members: OrganizationMemberDto[];
  membersStatus: QueryStatus;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState<string | null>(null);
  const createMutation = useCreateOrganizationRole();
  const updateMutation = useUpdateOrganizationRole();
  const deleteMutation = useDeleteOrganizationRole();
  const refresh = () =>
    invalidateQueryKeys(queryClient, [getListOrganizationRolesQueryKey(orgSlug)]);

  const openDialog = (next: DialogState) => {
    setError(null);
    setDialog(next);
  };

  const submit = async (values: RoleFormValues) => {
    if (!dialog) return;
    setError(null);
    try {
      if (dialog.mode === "edit") {
        await updateMutation.mutateAsync({ orgSlug, roleKey: dialog.role.key, data: values });
        toast.success(`${values.name} updated`);
      } else {
        await createMutation.mutateAsync({
          orgSlug,
          data: { ...values, key: roleKeyFromName(values.name) },
        });
        toast.success(`${values.name} created`);
      }
      await refresh();
      setDialog(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const membersFor = (role: RoleItem) =>
    membersStatus.isLoading
      ? undefined
      : members
          .filter((member) => member.role === role.key)
          .map((member) => ({ id: member.memberId, name: member.name ?? "", email: member.email }));

  return (
    <>
      <RoleWorkspace
        canManage={canManage}
        description="Organization roles decide what each member can do across the whole organization and every project. Each member has exactly one."
        groups={ORGANIZATION_PERMISSION_GROUPS}
        membersFor={membersFor}
        membersHref={`/orgs/${orgSlug}?tab=members`}
        onCreate={(startFrom) => openDialog({ mode: "create", startFrom })}
        onDelete={async (role) => {
          await deleteMutation.mutateAsync({ orgSlug, roleKey: role.key });
          await refresh();
        }}
        onEdit={(role) => openDialog({ mode: "edit", role })}
        roles={roles}
        status={status}
        title="Organization roles"
      />
      <Dialog onOpenChange={(open) => !open && setDialog(null)} open={dialog !== null}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "edit"
                ? `Edit ${dialog.role.name}`
                : dialog?.startFrom
                  ? `Duplicate ${dialog.startFrom.name}`
                  : "New organization role"}
            </DialogTitle>
            <DialogDescription>
              Grants permissions across the whole organization and all of its projects.
            </DialogDescription>
          </DialogHeader>
          {dialog ? (
            <RoleForm
              error={error}
              groups={ORGANIZATION_PERMISSION_GROUPS}
              isPending={createMutation.isPending || updateMutation.isPending}
              key={dialog.mode === "edit" ? dialog.role.id : (dialog.startFrom?.id ?? "new")}
              mode={dialog.mode}
              nameLabel="Organization role name"
              onSubmit={submit}
              permissionsLegend="Organization and project permissions"
              role={dialog.mode === "edit" ? dialog.role : null}
              roles={roles}
              showKeys
              startFrom={dialog.mode === "create" ? dialog.startFrom : null}
              submitLabel={dialog.mode === "edit" ? "Save changes" : "Create role"}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export { OrganizationRoleManagement };
