import type { FormEvent } from "react";
import type {
  OrganizationDto,
  OrganizationInvitationDto,
  OrganizationMemberDto,
  OrganizationRoleDto,
  ProjectDto,
  TeamDto,
} from "@/generated/api";

type OrganizationTab = "projects" | "members" | "teams" | "roles" | "settings";

/** Loading/error status of a list query, so tabs can tell "loading" apart from "empty". */
type QueryStatus = {
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
};

type OrganizationProjectsState = {
  projects: ProjectDto[];
  projectsStatus: QueryStatus;
  teams: TeamDto[];
  canManageProjects: boolean;
  projectOpen: boolean;
  projectError: string | null;
  createProject: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setProjectOpen: (open: boolean) => void;
  isCreatingProject: boolean;
};

type OrganizationMembersState = {
  members: OrganizationMemberDto[];
  invitations: OrganizationInvitationDto[];
  roles: OrganizationRoleDto[];
  membersStatus: QueryStatus;
  invitationsStatus: QueryStatus;
  rolesStatus: QueryStatus;
  canManageMembers: boolean;
  canInviteMembers: boolean;
  canRemoveMembers: boolean;
  canManageRoles: boolean;
  inviteOpen: boolean;
  inviteError: string | null;
  inviteMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resendInvitation: (invitationId: string) => void;
  setInviteOpen: (open: boolean) => void;
  isInvitingMember: boolean;
  isResendingInvitation: boolean;
};

type OrganizationTeamsState = {
  teams: TeamDto[];
  teamsStatus: QueryStatus;
  members: OrganizationMemberDto[];
  projects: ProjectDto[];
  canManageTeams: boolean;
  teamOpen: boolean;
  teamError: string | null;
  createTeam: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setTeamOpen: (open: boolean) => void;
  isCreatingTeam: boolean;
};

type OrganizationPageData = {
  orgSlug: string;
  organization: OrganizationDto;
  organizationName: string;
  activeTab: OrganizationTab;
  canManageSettings: boolean;
  canDelete: boolean;
  canManageMcp: boolean;
  projects: OrganizationProjectsState;
  members: OrganizationMembersState;
  teams: OrganizationTeamsState;
};

export type {
  OrganizationMembersState,
  OrganizationPageData,
  OrganizationProjectsState,
  OrganizationTab,
  OrganizationTeamsState,
  QueryStatus,
};
