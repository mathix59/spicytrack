import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  getGetProjectQueryKey,
  getListProjectAuditQueryKey,
  type OrganizationMemberDto,
  type ProjectEnvironmentDto,
  type ProjectReleaseDto,
  type TeamDto,
  useGetProject,
  useGetMe,
  useGetRepoConnection,
  useListOrganizationMembers,
  useListProjectEnvironments,
  useListProjectReleases,
  useListTeams,
  useUpdateProject,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { HttpError } from "@/lib/orval-fetch";
import { invalidateQueryKeys } from "@/lib/query-utils";

import type { ProjectPageData, ProjectTab } from "./types";

const EMPTY_ENVIRONMENTS: ProjectEnvironmentDto[] = [];
const EMPTY_RELEASES: ProjectReleaseDto[] = [];
const EMPTY_TEAMS: TeamDto[] = [];
const EMPTY_MEMBERS: OrganizationMemberDto[] = [];
const VALID_TABS: ProjectTab[] = [
  "observability",
  "keys",
  "inventory",
  "alerting",
  "integrations",
  "audit",
];

function useProjectPage(): ProjectPageData | null {
  const { orgSlug = "", projectSlug = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get("tab") ?? "observability";
  const activeTab = VALID_TABS.includes(requestedTab as ProjectTab)
    ? (requestedTab as ProjectTab)
    : "observability";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [selectedReleaseVersion, setSelectedReleaseVersion] = useState(
    () => searchParams.get("releaseView") ?? "",
  );

  const projectQuery = useGetProject(orgSlug, projectSlug, {
    query: { retry: false },
  });
  const environmentsQuery = useListProjectEnvironments(orgSlug, projectSlug);
  const releasesQuery = useListProjectReleases(orgSlug, projectSlug);
  const teamsQuery = useListTeams(orgSlug);
  const membersQuery = useListOrganizationMembers(orgSlug);
  const meQuery = useGetMe();
  const repoConnectionQuery = useGetRepoConnection(orgSlug, projectSlug, {
    query: { retry: false, enabled: activeTab === "integrations" },
  });
  const updateProjectMutation = useUpdateProject({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getGetProjectQueryKey(orgSlug, projectSlug),
          getListProjectAuditQueryKey(orgSlug, projectSlug),
        ]);
      },
    },
  });

  const project = projectQuery.data?.data;
  const environments = environmentsQuery.data?.data ?? EMPTY_ENVIRONMENTS;
  const releases = releasesQuery.data?.data ?? EMPTY_RELEASES;
  const teams = teamsQuery.data?.data ?? EMPTY_TEAMS;
  const members = membersQuery.data?.data ?? EMPTY_MEMBERS;
  const role = meQuery.data?.data.memberships.find(
    (membership) => membership.slug === orgSlug,
  )?.role;
  const canManageIntegrations = ["owner", "admin", "manager"].includes(role ?? "");
  const hasRepoConnection = Boolean(
    repoConnectionQuery.data?.data &&
    !(repoConnectionQuery.error instanceof HttpError && repoConnectionQuery.error.status === 404),
  );

  useEffect(() => {
    const status = (projectQuery.error as { status?: number } | null)?.status;
    if (status === 403 || status === 404) {
      navigate("/app", { replace: true });
    }
  }, [navigate, projectQuery.error]);

  useEffect(() => {
    const firstRelease = releases[0]?.version;
    if (!selectedReleaseVersion && firstRelease) {
      setSelectedReleaseVersion(firstRelease);
    }
  }, [releases, selectedReleaseVersion]);

  const updateProjectSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setProjectError,
      action: () =>
        updateProjectMutation.mutateAsync({
          orgSlug,
          projectSlug,
          data: {
            name: String(formData.get("name") ?? ""),
            platform: String(formData.get("platform") ?? ""),
            status: String(formData.get("status") ?? ""),
            visibility: String(formData.get("visibility") ?? ""),
            teamId: String(formData.get("teamId") ?? "") || null,
            retentionDays: Number(formData.get("retentionDays") ?? 30),
            inboundRules: JSON.parse(String(formData.get("inboundRules") ?? "[]")),
            ownershipRules: JSON.parse(String(formData.get("ownershipRules") ?? "[]")),
            piiScrubFields: JSON.parse(String(formData.get("piiScrubFields") ?? "[]")),
            browserAllowedOrigins: String(formData.get("browserAllowedOrigins") ?? "")
              .split(/\r?\n/)
              .map((origin) => origin.trim())
              .filter(Boolean),
          },
        }),
      onSuccess: async (response) => {
        if (response.data.slug !== projectSlug) {
          window.location.assign(`/orgs/${orgSlug}/projects/${response.data.slug}`);
          return;
        }

        setSettingsOpen(false);
      },
    });
  };

  if (!project) {
    return null;
  }

  return {
    orgSlug,
    projectSlug,
    activeTab,
    project,
    teams,
    members,
    environments,
    releases,
    selectedReleaseVersion,
    settingsOpen,
    projectError,
    canManageIntegrations,
    hasRepoConnection,
    setSettingsOpen,
    setSelectedReleaseVersion,
    openIssue: (issueId: string) =>
      navigate(`/orgs/${orgSlug}/projects/${projectSlug}/issues/${issueId}`),
    updateProjectSettings,
    isSavingSettings: updateProjectMutation.isPending,
  };
}

export { useProjectPage };
