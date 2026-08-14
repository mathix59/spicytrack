import { Building2 } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { OrganizationSettingsPanel } from "@/components/organizations/organization-settings-panel";

import { OrganizationMemberTab } from "./organization-page/member-tab";
import { OrganizationProjectTab } from "./organization-page/project-tab";
import { OrganizationRoleTab } from "./organization-page/role-tab";
import { OrganizationTeamTab } from "./organization-page/team-tab";
import { useOrganizationPage } from "./organization-page/use-organization-page";

function OrganizationPage() {
  const page = useOrganizationPage();

  if (!page) {
    return null;
  }

  return (
    <section className="grid gap-6">
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
          orgSlug={page.orgSlug}
          organizationRoles={page.members.roles}
          teams={page.teams.teams}
        />
      ) : null}

      {page.activeTab === "settings" ? (
        <OrganizationSettingsPanel
          canManage={page.canManageSettings}
          canManageMcp={page.canManageMcp}
          orgSlug={page.orgSlug}
          projects={page.projects.projects}
        />
      ) : null}
    </section>
  );
}

export { OrganizationPage };
