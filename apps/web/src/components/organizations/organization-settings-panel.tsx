import { OrgAiSettingsCard } from "@/components/organizations/org-ai-settings-card";
import { OrganizationJobQueueCard } from "@/components/organizations/organization-job-queue-card";
import { McpSettingsCard } from "@/components/organizations/mcp-settings-card";
import type { ProjectDto } from "@/generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function OrganizationSettingsPanel({
  orgSlug,
  canManage,
  canManageMcp,
  projects,
}: {
  orgSlug: string;
  canManage: boolean;
  canManageMcp: boolean;
  projects: ProjectDto[];
}) {
  return (
    <Tabs className="grid gap-4" defaultValue="ai">
      <TabsList className="w-fit">
        <TabsTrigger value="ai">AI</TabsTrigger>
        <TabsTrigger value="jobs">Job queue</TabsTrigger>
        <TabsTrigger value="mcp">MCP</TabsTrigger>
      </TabsList>

      <TabsContent className="mt-0" value="ai">
        <OrgAiSettingsCard canManage={canManage} orgSlug={orgSlug} />
      </TabsContent>

      <TabsContent className="mt-0" value="jobs">
        <OrganizationJobQueueCard canManage={canManage} orgSlug={orgSlug} />
      </TabsContent>

      <TabsContent className="mt-0" value="mcp">
        <McpSettingsCard canManage={canManageMcp} orgSlug={orgSlug} projects={projects} />
      </TabsContent>
    </Tabs>
  );
}

export { OrganizationSettingsPanel };
