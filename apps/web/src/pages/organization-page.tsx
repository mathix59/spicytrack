import { Building2 } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { OrganizationSettingsPanel } from "@/components/organizations/organization-settings-panel";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

import { OrganizationMemberTab } from "./organization-page/member-tab";
import { OrganizationProjectTab } from "./organization-page/project-tab";
import { OrganizationRoleTab } from "./organization-page/role-tab";
import { OrganizationTeamTab } from "./organization-page/team-tab";
import { useOrganizationPage } from "./organization-page/use-organization-page";

function OrganizationPage() {
  const result = useOrganizationPage();

  if (result.state === "loading") {
    return (
      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        <Skeleton className="h-10 w-64" />
        <SkeletonRows rows={4} />
      </section>
    );
  }

  if (result.state === "error") {
    return (
      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        <QueryError
          error={result.error}
          onRetry={result.retry}
          title="Could not load this organization"
        />
      </section>
    );
  }

  const { page } = result;

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader eyebrow="Organization" icon={Building2} title={page.organizationName} />

      {page.activeTab === "projects" ? (
        <OrganizationProjectTab orgSlug={page.orgSlug} state={page.projects} />
      ) : null}

      {page.activeTab === "members" ? (
        <OrganizationMemberTab orgSlug={page.orgSlug} state={page.members} />
      ) : null}

      {page.activeTab === "teams" ? (
        <OrganizationTeamTab orgSlug={page.orgSlug} state={page.teams} />
      ) : null}

      {page.activeTab === "roles" ? (
        <OrganizationRoleTab
          canManageRoles={page.canManageSettings}
          members={page.members.members}
          membersStatus={page.members.membersStatus}
          orgSlug={page.orgSlug}
          organizationRoles={page.members.roles}
          organizationRolesStatus={page.members.rolesStatus}
          teams={page.teams.teams}
          teamsStatus={page.teams.teamsStatus}
        />
      ) : null}

      {page.activeTab === "settings" ? (
        <OrganizationSettingsPanel
          canManage={page.canManageSettings}
          canDelete={page.canDelete}
          canManageMcp={page.canManageMcp}
          organization={page.organization}
          projects={page.projects.projects}
        />
      ) : null}
    </section>
  );
}

export { OrganizationPage };
