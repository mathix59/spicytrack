import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";

import { AuditLogView } from "@/components/audit/audit-log-view";
import type { AuditLogSource } from "@/components/audit/use-audit-log";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getListOrganizationAuditQueryKey,
  listOrganizationAudit,
  type OrganizationMemberDto,
  type ProjectDto,
  useGetOrganizationAuditFacets,
} from "@/generated/api";

function OrganizationAuditTab({
  canReadAudit,
  members,
  orgSlug,
  projects,
}: {
  canReadAudit: boolean;
  members: OrganizationMemberDto[];
  orgSlug: string;
  projects: ProjectDto[];
}) {
  const facetsQuery = useGetOrganizationAuditFacets(orgSlug, {
    query: { enabled: canReadAudit },
  });
  const source = useMemo<AuditLogSource>(
    () => ({
      queryKey: getListOrganizationAuditQueryKey(orgSlug),
      fetchPage: async (params) => (await listOrganizationAudit(orgSlug, params)).data,
      facets: facetsQuery.data?.data,
      exportPath: `/organizations/${orgSlug}/audit/export`,
      exportBaseName: orgSlug,
    }),
    [orgSlug, facetsQuery.data],
  );

  if (!canReadAudit) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            description="Ask an organization owner or admin for a role with audit access."
            icon={ShieldAlert}
            title="You can't view this organization's audit log"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <AuditLogView
      actors={members.map((member) => ({
        id: member.userId,
        label: member.name ? `${member.name} (${member.email})` : member.email,
      }))}
      description="Who changed members, roles, projects, keys and settings — with their IP address and whether they used an API token. Entries are kept according to the instance retention policy."
      projects={projects.map((project) => ({ id: project.id, label: project.name }))}
      source={source}
    />
  );
}

export { OrganizationAuditTab };
