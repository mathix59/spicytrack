import { ProjectIntegrationsPanel } from "@/components/integrations/project-integrations-panel";
import { ProjectAlertsPanel } from "@/components/projects/project-alerts-panel";
import { ProjectAuditTab } from "@/components/projects/project-audit-tab";
import { ProjectInventoryTab } from "@/components/projects/project-inventory-tab";
import { ProjectKeysTab } from "@/components/projects/project-keys-tab";
import { ProjectObservabilityTab } from "@/components/projects/project-observability-tab";

import type { ProjectPageData } from "./types";

function ProjectPageContent({ page }: { page: ProjectPageData }) {
  if (page.activeTab === "observability") {
    return <ProjectObservabilityTab orgSlug={page.orgSlug} projectSlug={page.projectSlug} />;
  }

  if (page.activeTab === "keys") {
    return (
      <ProjectKeysTab
        orgSlug={page.orgSlug}
        projectPlatform={page.project.platform}
        projectSlug={page.projectSlug}
      />
    );
  }

  if (page.activeTab === "inventory") {
    return (
      <ProjectInventoryTab
        environments={page.environments}
        onOpenIssue={page.openIssue}
        onSelectRelease={page.setSelectedReleaseVersion}
        orgSlug={page.orgSlug}
        projectSlug={page.projectSlug}
        releases={page.releases}
        selectedReleaseVersion={page.selectedReleaseVersion}
      />
    );
  }

  if (page.activeTab === "alerting") {
    return <ProjectAlertsPanel orgSlug={page.orgSlug} projectSlug={page.projectSlug} />;
  }

  if (page.activeTab === "integrations") {
    return (
      <ProjectIntegrationsPanel
        canManage={page.canManageIntegrations}
        hasRepoConnection={page.hasRepoConnection}
        orgSlug={page.orgSlug}
        projectSlug={page.projectSlug}
      />
    );
  }

  return (
    <ProjectAuditTab members={page.members} orgSlug={page.orgSlug} projectSlug={page.projectSlug} />
  );
}

export { ProjectPageContent };
