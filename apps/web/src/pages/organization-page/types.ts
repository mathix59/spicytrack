import type { FormEvent } from "react";
import type {
  OrganizationInvitationDto,
  OrganizationMemberDto,
  OrganizationRoleDto,
  ProjectDto,
  TeamDto,
} from "@/generated/api";

type OrganizationTab = "projects" | "members" | "teams" | "roles" | "settings";

type OrganizationProjectsState = {
  projects: ProjectDto[];
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
  canManageMembers: boolean;
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
  organizationName: string;
  activeTab: OrganizationTab;
  canManageSettings: boolean;
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
};
