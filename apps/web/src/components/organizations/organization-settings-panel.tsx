import { useSearchParams } from "react-router-dom";

import { OrgGithubAppCard } from "@/components/integrations/org-github-app-card";
import type { OrganizationDto, ProjectDto } from "@/generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DeleteOrganizationCard } from "./delete-organization-card";
import { McpSettingsCard } from "./mcp-settings-card";
import { OrgAiSettingsCard } from "./org-ai-settings-card";
import { OrganizationJobQueueCard } from "./organization-job-queue-card";
import { OrganizationGeneralCard } from "./settings/organization-general-card";

const SETTINGS_SECTIONS = ["general", "ai", "jobs", "mcp", "danger"] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

function isSettingsSection(value: string | null): value is SettingsSection {
  return SETTINGS_SECTIONS.includes(value as SettingsSection);
}

/** Organization settings, with the active section kept in `?section=` so it survives reloads. */
function OrganizationSettingsPanel({
  organization,
  canManage,
  canDelete,
  canManageMcp,
  projects,
}: {
  organization: OrganizationDto;
  canManage: boolean;
  canDelete: boolean;
  canManageMcp: boolean;
  projects: ProjectDto[];
}) {
  const orgSlug = organization.slug;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("section");
  const section: SettingsSection =
    isSettingsSection(requested) && (requested !== "danger" || canDelete) ? requested : "general";

  const selectSection = (next: string) => {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set("section", next);
        return params;
      },
      { replace: true },
    );
  };

  return (
    <Tabs
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4"
      onValueChange={selectSection}
      value={section}
    >
      <TabsList variant="underline">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="ai">AI</TabsTrigger>
        <TabsTrigger value="jobs">Job queue</TabsTrigger>
        <TabsTrigger value="mcp">MCP</TabsTrigger>
        {canDelete ? (
          <TabsTrigger
            className="data-[state=active]:border-destructive data-[state=active]:text-destructive"
            value="danger"
          >
            Delete organization
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent className="mt-0 grid grid-cols-[minmax(0,1fr)] gap-6" value="general">
        <OrganizationGeneralCard organization={organization} />
        <OrgGithubAppCard canManage={canManage} orgSlug={orgSlug} />
      </TabsContent>

      <TabsContent className="mt-0" value="ai">
        <OrgAiSettingsCard canManage={canManage} orgSlug={orgSlug} />
      </TabsContent>

      <TabsContent className="mt-0" value="jobs">
        <OrganizationJobQueueCard canManage={canManage} orgSlug={orgSlug} />
      </TabsContent>

      <TabsContent className="mt-0" value="mcp">
        <McpSettingsCard canManage={canManageMcp} orgSlug={orgSlug} projects={projects} />
      </TabsContent>

      {canDelete ? (
        <TabsContent className="mt-0" value="danger">
          <DeleteOrganizationCard orgSlug={orgSlug} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

export { OrganizationSettingsPanel };
