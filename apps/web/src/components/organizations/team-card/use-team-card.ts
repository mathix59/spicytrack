import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListTeamMembersQueryKey,
  getListTeamsQueryKey,
  useAddTeamMember,
  useDeleteTeam,
  useListTeamMembers,
  useListTeamRoles,
  useRemoveTeamMember,
  useUpdateTeam,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

import type { TeamCardData, TeamCardProps } from "./types";

function useTeamCard({ orgSlug, team, members, projects, canManage }: TeamCardProps): TeamCardData {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const teamMembersQuery = useListTeamMembers(orgSlug, team.slug);
  const teamRolesQuery = useListTeamRoles(orgSlug, team.slug);

  const addTeamMemberMutation = useAddTeamMember({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListTeamMembersQueryKey(orgSlug, team.slug)]);
      },
    },
  });
  const removeTeamMemberMutation = useRemoveTeamMember({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListTeamMembersQueryKey(orgSlug, team.slug)]);
      },
    },
  });

  const refreshTeams = async () => {
    await invalidateQueryKeys(queryClient, [getListTeamsQueryKey(orgSlug)]);
  };

  const updateTeamMutation = useUpdateTeam({ mutation: { onSuccess: refreshTeams } });
  const deleteTeamMutation = useDeleteTeam({ mutation: { onSuccess: refreshTeams } });

  const teamMembers = teamMembersQuery.data?.data.members ?? [];
  const teamRoles = teamRolesQuery.data?.data ?? [];
  const teamProjects = projects.filter((project) => project.teamId === team.id);
  const availableMembers = members.filter(
    (member) => !teamMembers.some((teamMember) => teamMember.userId === member.userId),
  );

  const submitMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await addTeamMemberMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        data: {
          userId: String(formData.get("userId") ?? ""),
          role: String(formData.get("role") ?? teamRoles[0]?.key ?? ""),
        },
      });
      setAddOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    try {
      await updateTeamMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        data: {
          name: String(formData.get("name") ?? ""),
          description: String(formData.get("description") ?? "") || null,
        },
      });
      setEditOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const removeMember = async (userId: string) => {
    setError(null);

    try {
      await removeTeamMemberMutation.mutateAsync({
        orgSlug,
        teamSlug: team.slug,
        userId,
      });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const handleDeleteTeam = async () => {
    setError(null);

    try {
      await deleteTeamMutation.mutateAsync({ orgSlug, teamSlug: team.slug });
      setDeleteOpen(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return {
    error,
    expanded,
    canManage,
    addOpen,
    editOpen,
    deleteOpen,
    teamMembers,
    teamRoles,
    teamProjects,
    availableMembers,
    isAddingMember: addTeamMemberMutation.isPending,
    isRemovingMember: removeTeamMemberMutation.isPending,
    isUpdatingTeam: updateTeamMutation.isPending,
    isDeletingTeam: deleteTeamMutation.isPending,
    toggleExpanded: () => setExpanded((current) => !current),
    setAddOpen,
    setEditOpen,
    setDeleteOpen,
    submitMember,
    submitEdit,
    removeMember,
    deleteTeam: handleDeleteTeam,
  };
}

export { useTeamCard };
