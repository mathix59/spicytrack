import { useState } from "react";
import type { FormEvent } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import {
  getListTeamRolesQueryKey,
  type OrganizationRoleDto,
  type TeamDto,
  type TeamRoleDto,
  useCreateTeamRole,
  useDeleteTeamRole,
  useListTeamRoles,
  useUpdateTeamRole,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { invalidateQueryKeys } from "@/lib/query-utils";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { TEAM_PERMISSIONS } from "@/components/organizations/team-card/constants";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { OrganizationRoleManagement } from "@/components/organizations/organization-role-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function OrganizationRoleTab({
  orgSlug,
  teams,
  organizationRoles,
  canManageRoles,
}: {
  orgSlug: string;
  teams: TeamDto[];
  organizationRoles: OrganizationRoleDto[];
  canManageRoles: boolean;
}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateRole, setDuplicateRole] = useState<TeamRoleDto | null>(null);
  const [deleteRole, setDeleteRole] = useState<TeamRoleDto | null>(null);
  const [editRole, setEditRole] = useState<TeamRoleDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedTeamSlug = searchParams.get("team");
  const team = teams.find((item) => item.slug === requestedTeamSlug) ?? teams[0];
  const rolesQuery = useListTeamRoles(orgSlug, team?.slug ?? "", {
    query: { enabled: Boolean(team) },
  });
  const roles = rolesQuery.data?.data ?? [];
  const createRoleMutation = useCreateTeamRole();
  const deleteRoleMutation = useDeleteTeamRole();
  const updateRoleMutation = useUpdateTeamRole();

  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!team) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    try {
      await createRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        data: {
          name: String(formData.get("name") ?? "").trim(),
          permissions: formData.getAll("permissions").map(String),
        },
      });
      await invalidateQueryKeys(queryClient, [getListTeamRolesQueryKey(orgSlug, team.slug)]);
      form.reset();
      setCreateOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const duplicate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!duplicateRole) return;

    const targetTeamSlug = String(new FormData(event.currentTarget).get("teamSlug") ?? "");
    setError(null);
    try {
      await createRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: targetTeamSlug,
        data: { name: duplicateRole.name, permissions: duplicateRole.permissions },
      });
      await invalidateQueryKeys(queryClient, [getListTeamRolesQueryKey(orgSlug, targetTeamSlug)]);
      setDuplicateRole(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const removeRole = async () => {
    if (!team || !deleteRole) return;

    setError(null);
    try {
      await deleteRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        roleKey: deleteRole.key,
      });
      await invalidateQueryKeys(queryClient, [getListTeamRolesQueryKey(orgSlug, team.slug)]);
      setDeleteRole(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const updateRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!team || !editRole) return;

    const formData = new FormData(event.currentTarget);
    setError(null);
    try {
      await updateRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        roleKey: editRole.key,
        data: {
          name: String(formData.get("name") ?? "").trim(),
          permissions: formData.getAll("permissions").map(String),
        },
      });
      await invalidateQueryKeys(queryClient, [getListTeamRolesQueryKey(orgSlug, team.slug)]);
      setEditRole(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const selectTeam = (teamSlug: string) => {
    setSearchParams({ tab: "roles", team: teamSlug });
    setError(null);
  };

  return (
    <Tabs className="grid gap-4" defaultValue="organization">
      <TabsList className="w-fit">
        <TabsTrigger value="organization">Organization roles</TabsTrigger>
        <TabsTrigger value="team">Team roles</TabsTrigger>
      </TabsList>
      <TabsContent value="organization">
        <OrganizationRoleManagement
          canManage={canManageRoles}
          orgSlug={orgSlug}
          roles={organizationRoles}
        />
      </TabsContent>
      <TabsContent value="team">
        <Card>
          <OrganizationSectionHeader
            action={
              canManageRoles && team ? (
                <Button onClick={() => setCreateOpen(true)} type="button">
                  <Plus className="size-4" />
                  New role
                </Button>
              ) : null
            }
            count={roles.length}
            description="Team roles apply only to members of the selected team and its projects."
            title="Team roles"
          >
            {teams.length > 0 ? (
              <Field label="Team" className="max-w-sm">
                <Select
                  onChange={(event) => selectTeam(event.target.value)}
                  value={team?.slug ?? ""}
                >
                  {teams.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </OrganizationSectionHeader>
          <CardContent>
            {!team ? (
              <EmptyState
                title="No teams yet"
                description="Create a team before configuring roles and permissions."
              />
            ) : roles.length === 0 ? (
              <EmptyState
                title="No team roles yet"
                description="Create a team role to set access for this team."
              />
            ) : (
              <div className="grid gap-3">
                {roles.map((role) => (
                  <article className="rounded-lg border border-border p-4" key={role.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{role.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {role.permissions.length} permission
                          {role.permissions.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      {canManageRoles ? (
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setDuplicateRole(role)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Copy className="size-4" />
                            Duplicate to team
                          </Button>
                          {!role.isSystem ? (
                            <>
                              <Button
                                aria-label={`Edit ${role.name}`}
                                onClick={() => setEditRole(role)}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                aria-label={`Delete ${role.name}`}
                                onClick={() => setDeleteRole(role)}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {role.permissions.map((permission) => (
                        <Badge key={permission} variant="accent">
                          {permission.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>

          <Dialog onOpenChange={setCreateOpen} open={createOpen}>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New role for {team?.name}</DialogTitle>
                <DialogDescription>
                  Choose the permissions granted to members of this team.
                </DialogDescription>
              </DialogHeader>
              <RoleForm
                error={error}
                isPending={createRoleMutation.isPending}
                onSubmit={createRole}
              />
            </DialogContent>
          </Dialog>

          <Dialog
            onOpenChange={(open) => !open && setDuplicateRole(null)}
            open={Boolean(duplicateRole)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Duplicate {duplicateRole?.name}</DialogTitle>
                <DialogDescription>
                  Copy this role and all its permissions to another team.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" onSubmit={duplicate}>
                <Field label="Destination team">
                  <Select defaultValue="" name="teamSlug" required>
                    <option disabled value="">
                      Choose a team
                    </option>
                    {teams
                      .filter((item) => item.id !== team?.id)
                      .map((item) => (
                        <option key={item.id} value={item.slug}>
                          {item.name}
                        </option>
                      ))}
                  </Select>
                </Field>
                {error ? <ErrorAlert error={error} /> : null}
                <Button disabled={createRoleMutation.isPending || teams.length < 2} type="submit">
                  Duplicate role
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog onOpenChange={(open) => !open && setEditRole(null)} open={Boolean(editRole)}>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit {editRole?.name}</DialogTitle>
                <DialogDescription>
                  Update this custom role's name and permissions.
                </DialogDescription>
              </DialogHeader>
              <RoleForm
                error={error}
                isPending={updateRoleMutation.isPending}
                onSubmit={updateRole}
                role={editRole}
                submitLabel="Save changes"
              />
            </DialogContent>
          </Dialog>

          <Dialog onOpenChange={(open) => !open && setDeleteRole(null)} open={Boolean(deleteRole)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {deleteRole?.name}?</DialogTitle>
                <DialogDescription>
                  This permanently removes the custom role from {team?.name}. Members using it must
                  be reassigned first.
                </DialogDescription>
              </DialogHeader>
              {error ? <ErrorAlert error={error} /> : null}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setDeleteRole(null)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button
                  disabled={deleteRoleMutation.isPending}
                  onClick={() => void removeRole()}
                  type="button"
                >
                  Delete role
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function RoleForm({
  error,
  isPending,
  onSubmit,
  role,
  submitLabel = "Create role",
}: {
  error: string | null;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  role?: TeamRoleDto | null;
  submitLabel?: string;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field label="Role name">
        <Input defaultValue={role?.name} name="name" required />
      </Field>
      <Field label="Permissions">
        <div className="grid gap-2 sm:grid-cols-2">
          {TEAM_PERMISSIONS.map((permission) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              key={permission}
            >
              <input
                defaultChecked={role?.permissions.includes(permission)}
                name="permissions"
                type="checkbox"
                value={permission}
              />
              <span className="capitalize">{permission.replaceAll("_", " ")}</span>
            </label>
          ))}
        </div>
      </Field>
      {error ? <ErrorAlert error={error} /> : null}
      <Button disabled={isPending} type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}

function ErrorAlert({ error }: { error: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

export { OrganizationRoleTab };
