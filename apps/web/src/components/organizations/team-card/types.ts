import type { FormEvent } from "react";

import type {
  OrganizationMemberDto,
  ProjectDto,
  TeamDto,
  TeamMemberDto,
  TeamRoleDto,
} from "@/generated/api";

type TeamCardData = {
  error: string | null;
  expanded: boolean;
  canManage: boolean;
  addOpen: boolean;
  editOpen: boolean;
  deleteOpen: boolean;
  teamMembers: TeamMemberDto[];
  teamRoles: TeamRoleDto[];
  teamProjects: ProjectDto[];
  availableMembers: OrganizationMemberDto[];
  isAddingMember: boolean;
  isRemovingMember: boolean;
  isUpdatingTeam: boolean;
  isDeletingTeam: boolean;
  toggleExpanded: () => void;
  setAddOpen: (open: boolean) => void;
  setEditOpen: (open: boolean) => void;
  setDeleteOpen: (open: boolean) => void;
  submitMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  submitEdit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  deleteTeam: () => Promise<void>;
};

type TeamCardProps = {
  orgSlug: string;
  team: TeamDto;
  members: OrganizationMemberDto[];
  projects: ProjectDto[];
  canManage: boolean;
};

export type { TeamCardData, TeamCardProps };
