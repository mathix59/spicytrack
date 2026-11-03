import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import {
  getListTeamRolesQueryKey,
  type TeamDto,
  type TeamRoleDto,
  useCreateTeamRole,
  useDeleteTeamRole,
  useListTeamMembers,
  useListTeamRoles,
  useUpdateTeamRole,
} from "@/generated/api";
import type { RoleFormValues, RoleItem, RoleMember } from "@/components/organizations/roles/types";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

const EMPTY_ROLES: TeamRoleDto[] = [];

type TeamRoleDialog =
  | { mode: "create"; startFrom?: RoleItem }
  | { mode: "edit"; role: RoleItem }
  | null;

function useTeamRoles({ orgSlug, teams }: { orgSlug: string; teams: TeamDto[] }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialog, setDialog] = useState<TeamRoleDialog>(null);
  const [copyRole, setCopyRole] = useState<RoleItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedTeamSlug = searchParams.get("team");
  const team = teams.find((item) => item.slug === requestedTeamSlug) ?? teams[0];
  const rolesQuery = useListTeamRoles(orgSlug, team?.slug ?? "", {
    query: { enabled: Boolean(team) },
  });
  const membersQuery = useListTeamMembers(orgSlug, team?.slug ?? "", {
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

  const submitRole = (values: RoleFormValues) => {
    if (!team || !dialog) return;
    return runFormAction(async () => {
      if (dialog.mode === "edit") {
        await updateRoleMutation.mutateAsync({
          orgSlug,
          teamSlug: team.slug,
          roleKey: dialog.role.key,
          data: values,
        });
        toast.success(`${values.name} updated`);
      } else {
        await createRoleMutation.mutateAsync({ orgSlug, teamSlug: team.slug, data: values });
        toast.success(`${values.name} created`);
      }
      await refreshRoles(team.slug);
      setDialog(null);
    });
  };

  const copyToTeam = (targetTeamSlug: string) => {
    if (!copyRole) return;
    return runFormAction(async () => {
      await createRoleMutation.mutateAsync({
        orgSlug,
        teamSlug: targetTeamSlug,
        data: {
          name: copyRole.name,
          description: copyRole.description ?? null,
          permissions: copyRole.permissions,
        },
      });
      await refreshRoles(targetTeamSlug);
      const target = teams.find((item) => item.slug === targetTeamSlug);
      toast.success(`${copyRole.name} copied to ${target?.name ?? targetTeamSlug}`);
      setCopyRole(null);
    });
  };

  /** Rethrows so the confirmation dialog can show the failure inline. */
  const removeRole = async (role: RoleItem) => {
    if (!team) return;
    await deleteRoleMutation.mutateAsync({ orgSlug, teamSlug: team.slug, roleKey: role.key });
    await refreshRoles(team.slug);
  };

  const selectTeam = (teamSlug: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("team", teamSlug);
        // Role keys are per team: let the new team open on its first role.
        next.delete("role");
        return next;
      },
      { replace: true },
    );
  };

  const teamMembers = membersQuery.data?.data.members;
  const membersFor = (role: RoleItem): RoleMember[] | undefined =>
    teamMembers
      ?.filter((member) => member.role === role.key)
      .map((member) => ({ id: member.teamMemberId, name: member.name ?? "", email: member.email }));

  const withErrorReset =
    <T>(setter: (value: T) => void) =>
    (value: T) => {
      setError(null);
      setter(value);
    };

  return {
    team,
    roles,
    rolesStatus: {
      isLoading: Boolean(team) && rolesQuery.isPending && !rolesQuery.isError,
      error: rolesQuery.isError ? rolesQuery.error : null,
      refetch: () => void rolesQuery.refetch(),
    },
    membersFor,
    error,
    dialog,
    copyRole,
    setDialog: withErrorReset(setDialog),
    setCopyRole: withErrorReset(setCopyRole),
    isSaving: createRoleMutation.isPending || updateRoleMutation.isPending,
    submitRole,
    copyToTeam,
    removeRole,
    selectTeam,
  };
}

type TeamRolesState = ReturnType<typeof useTeamRoles>;

export { useTeamRoles };
export type { TeamRolesState };
