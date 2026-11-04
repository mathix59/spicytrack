import { useParams, useSearchParams } from "react-router-dom";

import {
  type OrganizationInvitationDto,
  type OrganizationMemberDto,
  type OrganizationRoleDto,
  type ProjectDto,
  type TeamDto,
  useGetMe,
  useGetOrganization,
  useListOrganizationInvitations,
  useListOrganizationMembers,
  useListOrganizationRoles,
  useListProjects,
  useListTeams,
} from "@/generated/api";

import type { OrganizationPageData, OrganizationTab, QueryStatus } from "./types";
import { useOrganizationPageActions } from "./use-organization-page-actions";

const EMPTY_MEMBERS: OrganizationMemberDto[] = [];
const EMPTY_INVITATIONS: OrganizationInvitationDto[] = [];
const EMPTY_ROLES: OrganizationRoleDto[] = [];
const EMPTY_TEAMS: TeamDto[] = [];
const EMPTY_PROJECTS: ProjectDto[] = [];
const VALID_TABS: OrganizationTab[] = [
  "projects",
  "members",
  "teams",
  "roles",
  "audit",
  "settings",
];

type OrganizationPageResult =
  | { state: "loading" }
  | { state: "error"; error: unknown; retry: () => void }
  | { state: "ready"; page: OrganizationPageData };

function toQueryStatus(query: {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}): QueryStatus {
  return {
    isLoading: query.isPending && !query.isError,
    error: query.isError ? query.error : null,
    refetch: () => void query.refetch(),
  };
}

function useOrganizationPage(): OrganizationPageResult {
  const { orgSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
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
  const actions = useOrganizationPageActions(orgSlug);

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
    return organizationQuery.isError
      ? {
          state: "error",
          error: organizationQuery.error,
          retry: () => void organizationQuery.refetch(),
        }
      : { state: "loading" };
  }

  const page: OrganizationPageData = {
    orgSlug,
    organization,
    organizationName: organization.name,
    activeTab,
    canManageSettings,
    canDelete: organizationMembership?.role === "owner",
    canManageMcp,
    canReadAudit: permissions.has("audit.read"),
    projects: {
      ...actions.projects,
      projects,
      projectsStatus: toQueryStatus(projectsQuery),
      teams,
      canManageProjects,
    },
    members: {
      ...actions.members,
      members,
      invitations,
      roles,
      membersStatus: toQueryStatus(membersQuery),
      invitationsStatus: toQueryStatus(invitationsQuery),
      rolesStatus: toQueryStatus(rolesQuery),
      canManageMembers,
      canInviteMembers: permissions.has("org.members.invite"),
      canRemoveMembers: permissions.has("org.members.remove"),
      canManageRoles: canManageSettings,
    },
    teams: {
      ...actions.teams,
      teams,
      teamsStatus: toQueryStatus(teamsQuery),
      members,
      projects,
      canManageTeams,
    },
  };

  return { state: "ready", page };
}

export { useOrganizationPage };
export type { OrganizationPageResult };
