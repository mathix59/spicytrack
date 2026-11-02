import { FolderKanban } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { ProjectPageContent } from "./project-page/project-page-content";
import { ProjectTabsNav } from "./project-page/project-tabs-nav";
import { useProjectPage } from "./project-page/use-project-page";

function ProjectPageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading project" className="grid gap-6">
      <div className="flex items-center gap-3 border-b border-border pb-5">
        <Skeleton className="size-10 rounded-xl" />
        <div className="grid gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </section>
  );
}

function ProjectPage() {
  const { data: page, isLoading, error, retry } = useProjectPage();

  if (isLoading) {
    return <ProjectPageSkeleton />;
  }

  if (!page) {
    return <QueryError error={error} onRetry={retry} title="Could not load this project" />;
  }

  return (
    <section className="grid min-w-0 gap-5">
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

      <ProjectTabsNav
        activeTab={page.activeTab}
        orgSlug={page.orgSlug}
        projectSlug={page.projectSlug}
      />

      <ProjectPageContent page={page} />
    </section>
  );
}

export { ProjectPage };
