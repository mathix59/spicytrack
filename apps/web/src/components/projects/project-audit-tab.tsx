import { useMemo } from "react";

import {
  getListProjectAuditEntriesQueryKey,
  listProjectAuditEntries,
  type OrganizationMemberDto,
  useGetProjectAuditFacets,
} from "@/generated/api";
import { AuditLogView } from "@/components/audit/audit-log-view";
import type { AuditLogSource } from "@/components/audit/use-audit-log";

/** The organization audit log, narrowed to this project's entries. */
function ProjectAuditTab({
  members,
  orgSlug,
  projectSlug,
}: {
  members: OrganizationMemberDto[];
  orgSlug: string;
  projectSlug: string;
}) {
  const facetsQuery = useGetProjectAuditFacets(orgSlug, projectSlug);
  const source = useMemo<AuditLogSource>(
    () => ({
      queryKey: getListProjectAuditEntriesQueryKey(orgSlug, projectSlug),
      fetchPage: async (params) =>
        (await listProjectAuditEntries(orgSlug, projectSlug, params)).data,
      facets: facetsQuery.data?.data,
      exportPath: `/organizations/${orgSlug}/projects/${projectSlug}/audit/export`,
      exportBaseName: `${orgSlug}-${projectSlug}`,
    }),
    [orgSlug, projectSlug, facetsQuery.data],
  );

  return (
    <AuditLogView
      actors={members.map((member) => ({
        id: member.userId,
        label: member.name ? `${member.name} (${member.email})` : member.email,
      }))}
      description="Who changed this project's settings, keys, alert rules, integrations and issues, and when, with their IP address and whether they used an API token."
      emptyDescription="Key, settings, alert rule, integration and issue changes in this project will appear here."
      source={source}
    />
  );
}

export { ProjectAuditTab };
