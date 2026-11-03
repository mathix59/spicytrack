import { ProjectIntegrationsPanel } from "@/components/integrations/project-integrations-panel";
import { ProjectAlertsPanel } from "@/components/projects/project-alerts-panel";
import { ProjectAuditTab } from "@/components/projects/project-audit-tab";
import { ProjectInventoryTab } from "@/components/projects/project-inventory-tab";
import { ProjectKeysTab } from "@/components/projects/project-keys-tab";
import { ProjectObservabilityTab } from "@/components/projects/project-observability-tab";
import { ProjectSetupWizard } from "@/components/projects/project-setup-wizard";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { Link } from "react-router-dom";

import type { ProjectPageData } from "./types";

function ProjectPageContent({ page }: { page: ProjectPageData }) {
  if (page.activeTab === "observability") {
    return (
      <>
        {page.project.firstEventAt ? null : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-sm">
            <Rocket aria-hidden="true" className="size-4 shrink-0 text-info" />
            <p className="min-w-0 flex-1">
              <span className="font-medium">This project hasn&apos;t received events yet.</span>{" "}
              <span className="text-muted-foreground">
                Connect your SDK in a few minutes; issues appear here as soon as it reports.
              </span>
            </p>
            <Button asChild size="sm">
              <Link to={`/orgs/${page.orgSlug}/projects/${page.projectSlug}?tab=setup`}>
                Finish setup
              </Link>
            </Button>
          </div>
        )}
        <ProjectObservabilityTab orgSlug={page.orgSlug} projectSlug={page.projectSlug} />
      </>
    );
  }

  if (page.activeTab === "setup") {
    return (
      <ProjectSetupWizard
        orgSlug={page.orgSlug}
        projectPlatform={page.project.platform}
        projectSlug={page.projectSlug}
      />
    );
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
        onOpenIssue={page.openIssue}
        onSelectRelease={page.setSelectedReleaseVersion}
        orgSlug={page.orgSlug}
        projectSlug={page.projectSlug}
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
