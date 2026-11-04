import { useGetAutofixAvailability, useGetMe, useGetProjectPermissions } from "@/generated/api";

import type { AutofixRequirement, IssueCapabilities } from "./types";

const EMPTY: string[] = [];

/**
 * What the current user may do on this issue, and whether Autofix can run for the project.
 * Project permissions include team roles; until they load (or on an older API) the
 * organization role's permissions stand in for them.
 */
function useIssueCapabilities(orgSlug: string, projectSlug: string): IssueCapabilities {
  const meQuery = useGetMe();
  const permissionsQuery = useGetProjectPermissions(orgSlug, projectSlug, {
    query: { retry: false, staleTime: 60_000 },
  });
  const availabilityQuery = useGetAutofixAvailability(orgSlug, projectSlug, {
    query: { retry: false, staleTime: 30_000 },
  });

  const organizationPermissions =
    meQuery.data?.data.memberships.find((membership) => membership.slug === orgSlug)?.permissions ??
    EMPTY;
  const permissions = new Set(permissionsQuery.data?.data.permissions ?? organizationPermissions);
  const availability = availabilityQuery.data?.data;

  return {
    isLoading: permissionsQuery.isLoading || meQuery.isLoading,
    canManageIssues: permissions.has("project.issues.manage"),
    canRunAutofix: permissions.has("project.autofix.run"),
    canManageAutofix: permissions.has("project.autofix.manage"),
    canManageIntegrations: permissions.has("project.integrations.manage"),
    canManageOrganizationSettings: organizationPermissions.includes("org.settings.manage"),
    // Unknown availability (still loading, or an API without the endpoint) keeps the action
    // enabled; the server still refuses a run that cannot start.
    autofixMissing: (availability?.missing ?? []) as AutofixRequirement[],
  };
}

export { useIssueCapabilities };
