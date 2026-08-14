import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListOrganizationInvitationsQueryKey,
  getListOrganizationMembersQueryKey,
  getListProjectsQueryKey,
  getListTeamsQueryKey,
  type OrganizationInvitationDto,
  type OrganizationMemberDto,
  type OrganizationRoleDto,
  type ProjectDto,
  type TeamDto,
  useCreateOrganizationInvitation,
  useCreateProject,
  useCreateTeam,
  useGetMe,
  useGetOrganization,
  useListOrganizationInvitations,
  useListOrganizationMembers,
  useListOrganizationRoles,
  useListProjects,
  useListTeams,
  useResendOrganizationInvitation,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { slugify } from "@/lib/slug";

import type { OrganizationPageData, OrganizationTab } from "./types";

const EMPTY_MEMBERS: OrganizationMemberDto[] = [];
const EMPTY_INVITATIONS: OrganizationInvitationDto[] = [];
const EMPTY_ROLES: OrganizationRoleDto[] = [];
const EMPTY_TEAMS: TeamDto[] = [];
const EMPTY_PROJECTS: ProjectDto[] = [];
const VALID_TABS: OrganizationTab[] = ["projects", "members", "teams", "roles", "settings"];

function useOrganizationPage(): OrganizationPageData | null {
  const { orgSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const requestedTab = searchParams.get("tab") ?? "projects";
  const activeTab = VALID_TABS.includes(requestedTab as OrganizationTab)
    ? (requestedTab as OrganizationTab)
    : "projects";

  const organizationQuery = useGetOrganization(orgSlug);
  const meQuery = useGetMe();
  const membersQuery = useListOrganizationMembers(orgSlug);
  const invitationsQuery = useListOrganizationInvitations(orgSlug);
  const rolesQuery = useListOrganizationRoles(orgSlug);
  const teamsQuery = useListTeams(orgSlug);
  const projectsQuery = useListProjects(orgSlug);

  const createInvitationMutation = useCreateOrganizationInvitation({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getListOrganizationMembersQueryKey(orgSlug),
          getListOrganizationInvitationsQueryKey(orgSlug),
        ]);
      },
    },
  });
  const resendInvitationMutation = useResendOrganizationInvitation({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListOrganizationInvitationsQueryKey(orgSlug)]);
      },
    },
  });
  const createTeamMutation = useCreateTeam({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListTeamsQueryKey(orgSlug)]);
      },
    },
  });
  const createProjectMutation = useCreateProject({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListProjectsQueryKey(orgSlug)]);
      },
    },
  });

  const organization = organizationQuery.data?.data;
  const members = membersQuery.data?.data ?? EMPTY_MEMBERS;
  const invitations = invitationsQuery.data?.data ?? EMPTY_INVITATIONS;
  const roles = rolesQuery.data?.data ?? EMPTY_ROLES;
  const teams = teamsQuery.data?.data ?? EMPTY_TEAMS;
  const projects = projectsQuery.data?.data ?? EMPTY_PROJECTS;
  const organizationMembership = meQuery.data?.data.memberships.find(
    (membership) => membership.slug === orgSlug,
  );
  const permissions = new Set(organizationMembership?.permissions ?? []);
  const canManageTeams = permissions.has("org.teams.update");
  const canManageProjects = permissions.has("org.projects.update");
  const canManageMembers = permissions.has("org.members.update_role");
  const canManageSettings = permissions.has("org.settings.manage");
  const canManageMcp = permissions.has("org.mcp.manage");

  if (!organization) {
    return null;
  }

  const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setInviteError,
      action: () =>
        createInvitationMutation.mutateAsync({
          orgSlug,
          data: {
            email: String(formData.get("email") ?? ""),
            role: String(formData.get("role") ?? "member"),
          },
        }),
      onSuccess: async () => {
        setInviteOpen(false);
      },
    });
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "");
    await runAsyncFormAction({
      setError: setTeamError,
      action: () =>
        createTeamMutation.mutateAsync({
          orgSlug,
          data: {
            name,
            slug: slugify(name),
            description: String(formData.get("description") ?? "").trim() || undefined,
          },
        }),
      onSuccess: async () => {
        setTeamOpen(false);
      },
    });
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setProjectError,
      action: () =>
        createProjectMutation.mutateAsync({
          orgSlug,
          data: {
            name: String(formData.get("name") ?? ""),
            platform: String(
              formData.get("platform") ?? PLATFORM_OPTIONS[0]?.value ?? "javascript",
            ),
            visibility: String(formData.get("visibility") ?? "private"),
            teamId: (String(formData.get("teamId") ?? "") || undefined) as never,
          },
        }),
      onSuccess: async () => {
        setProjectOpen(false);
      },
    });
  };

  return {
    orgSlug,
    organizationName: organization.name,
    activeTab,
    canManageSettings,
    canManageMcp,
    projects: {
      projects,
      teams,
      canManageProjects,
      projectOpen,
      projectError,
      createProject,
      setProjectOpen,
      isCreatingProject: createProjectMutation.isPending,
    },
    members: {
      members,
      invitations,
      roles,
      canManageMembers,
      canManageRoles: canManageSettings,
      inviteOpen,
      inviteError,
      inviteMember,
      resendInvitation: (invitationId: string) =>
        resendInvitationMutation.mutate({ orgSlug, invitationId }),
      setInviteOpen,
      isInvitingMember: createInvitationMutation.isPending,
      isResendingInvitation: resendInvitationMutation.isPending,
    },
    teams: {
      teams,
      members,
      projects,
      canManageTeams,
      teamOpen,
      teamError,
      createTeam,
      setTeamOpen,
      isCreatingTeam: createTeamMutation.isPending,
    },
  };
}

export { useOrganizationPage };
