import { FolderKanban } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog";

import { ProjectPageContent } from "./project-page/project-page-content";
import { useProjectPage } from "./project-page/use-project-page";

function ProjectPage() {
  const page = useProjectPage();

  if (!page) {
    return null;
  }

  return (
    <section className="grid gap-6">
      <PageHeader
        actions={
          <ProjectSettingsDialog
            error={page.projectError}
            isSaving={page.isSavingSettings}
            onOpenChange={page.setSettingsOpen}
            onSubmit={page.updateProjectSettings}
            open={page.settingsOpen}
            project={page.project}
            teams={page.teams}
          />
        }
        eyebrow="Project"
        icon={FolderKanban}
        meta={`${page.project.platform} · ${page.project.visibility}`}
        title={page.project.name}
      />

      <ProjectPageContent page={page} />
    </section>
  );
}

export { ProjectPage };
