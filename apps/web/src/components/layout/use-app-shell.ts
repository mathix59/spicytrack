import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { MeResponseDto, ProjectDto } from "@/generated/api";

import { authClient } from "@/lib/auth-client";
import { useListProjects } from "@/generated/api";
import { getDisplayName } from "./app-shell-utils";

function useAppShell({
  me,
  currentOrgSlug,
  onLogout,
}: {
  me: MeResponseDto;
  currentOrgSlug?: string;
  onLogout: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
    } catch {
      // local token reset still matters if API logout fails
    }

    onLogout();
    navigate("/");
  };

  const displayName = getDisplayName(me);
  const initials = displayName.slice(0, 2).toUpperCase();
  const currentOrg = me.memberships.find((membership) => membership.slug === currentOrgSlug);
  const projectsQuery = useListProjects(currentOrgSlug ?? "", {
    query: { enabled: Boolean(currentOrgSlug) },
  });
  const projects = (projectsQuery.data?.data ?? []) as ProjectDto[];
  const currentProjectSlug = params.projectSlug;
  const currentIssueId = params.issueId;
  const searchTab = new URLSearchParams(location.search).get("tab");
  const activeProjectTab = searchTab ?? "observability";
  const isOrgPage = location.pathname === `/orgs/${currentOrgSlug}` && !currentProjectSlug;
  const orgTab = searchTab ?? "projects";

  return {
    navigate,
    handleLogout,
    displayName,
    initials,
    currentOrgName: currentOrg?.name,
    projects,
    currentProjectSlug,
    currentIssueId,
    activeProjectTab,
    isOrgPage,
    orgTab,
  };
}

export { useAppShell };
