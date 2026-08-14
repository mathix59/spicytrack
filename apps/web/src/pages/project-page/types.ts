import type { FormEvent } from "react";
import type {
  OrganizationMemberDto,
  ProjectDto,
  ProjectEnvironmentDto,
  ProjectReleaseDto,
  TeamDto,
} from "@/generated/api";

type ProjectTab = "observability" | "keys" | "inventory" | "alerting" | "integrations" | "audit";

type ProjectPageData = {
  orgSlug: string;
  projectSlug: string;
  activeTab: ProjectTab;
  project: ProjectDto;
  teams: TeamDto[];
  members: OrganizationMemberDto[];
  environments: ProjectEnvironmentDto[];
  releases: ProjectReleaseDto[];
  selectedReleaseVersion: string;
  settingsOpen: boolean;
  projectError: string | null;
  canManageIntegrations: boolean;
  hasRepoConnection: boolean;
  setSettingsOpen: (open: boolean) => void;
  setSelectedReleaseVersion: (version: string) => void;
  openIssue: (issueId: string) => void;
  updateProjectSettings: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isSavingSettings: boolean;
};

export type { ProjectPageData, ProjectTab };
