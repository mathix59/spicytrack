import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import {
  getListTeamRolesQueryKey,
  type TeamDto,
  type TeamRoleDto,
  useCreateTeamRole,
  useDeleteTeamRole,
  useListTeamRoles,
  useUpdateTeamRole,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

const EMPTY_ROLES: TeamRoleDto[] = [];

function readRoleForm(form: HTMLFormElement) {
  const formData = new FormData(form);
  return {
    name: String(formData.get("name") ?? "").trim(),
    permissions: formData.getAll("permissions").map(String),
  };
}

function useTeamRoles({ orgSlug, teams }: { orgSlug: string; teams: TeamDto[] }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateRole, setDuplicateRole] = useState<TeamRoleDto | null>(null);
  const [editRole, setEditRole] = useState<TeamRoleDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedTeamSlug = searchParams.get("team");
  const team = teams.find((item) => item.slug === requestedTeamSlug) ?? teams[0];
  const rolesQuery = useListTeamRoles(orgSlug, team?.slug ?? "", {
    query: { enabled: Boolean(team) },
  });
  const roles = rolesQuery.data?.data ?? EMPTY_ROLES;
  const createRoleMutation = useCreateTeamRole();
  const deleteRoleMutation = useDeleteTeamRole();
  const updateRoleMutation = useUpdateTeamRole();

  const refreshRoles = (teamSlug: string) =>
    invalidateQueryKeys(queryClient, [getListTeamRolesQueryKey(orgSlug, teamSlug)]);

  const runFormAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const createRole = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!team) return;
    const form = event.currentTarget;
    void runFormAction(async () => {
      await createRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        data: readRoleForm(form),
      });
      await refreshRoles(team.slug);
      setCreateOpen(false);
      toast.success("Team role created");
    });
  };

  const duplicate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!duplicateRole) return;
    const targetTeamSlug = String(new FormData(event.currentTarget).get("teamSlug") ?? "");
    void runFormAction(async () => {
      await createRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: targetTeamSlug,
        data: { name: duplicateRole.name, permissions: duplicateRole.permissions },
      });
      await refreshRoles(targetTeamSlug);
      setDuplicateRole(null);
      toast.success("Role duplicated");
    });
  };

  const updateRole = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!team || !editRole) return;
    const form = event.currentTarget;
    void runFormAction(async () => {
      await updateRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        roleKey: editRole.key,
        data: readRoleForm(form),
      });
      await refreshRoles(team.slug);
      setEditRole(null);
      toast.success("Team role updated");
    });
  };

  /** Rethrows so the confirmation dialog can show the failure inline. */
  const removeRole = async (role: TeamRoleDto) => {
    if (!team) return;
    await deleteRoleMutation.mutateAsync({ orgSlug, teamSlug: team.slug, roleKey: role.key });
    await refreshRoles(team.slug);
  };

  const selectTeam = (teamSlug: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("team", teamSlug);
        return next;
      },
      { replace: true },
    );
  };

  const withErrorReset =
    <T>(setter: (value: T) => void) =>
    (value: T) => {
      setError(null);
      setter(value);
    };

  return {
    team,
    roles,
    rolesQuery: {
      isLoading: Boolean(team) && rolesQuery.isPending && !rolesQuery.isError,
      error: rolesQuery.isError ? rolesQuery.error : null,
      refetch: () => void rolesQuery.refetch(),
    },
    error,
    createOpen,
    duplicateRole,
    editRole,
    setCreateOpen: withErrorReset(setCreateOpen),
    setDuplicateRole: withErrorReset(setDuplicateRole),
    setEditRole: withErrorReset(setEditRole),
    isCreating: createRoleMutation.isPending,
    isUpdating: updateRoleMutation.isPending,
    createRole,
    duplicate,
    updateRole,
    removeRole,
    selectTeam,
  };
}

type TeamRolesState = ReturnType<typeof useTeamRoles>;

export { useTeamRoles };
export type { TeamRolesState };
