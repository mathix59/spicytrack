import { Link } from "react-router-dom";

import { AutofixConfigCard } from "@/components/integrations/autofix-config-card";
import { RepoConnectionCard } from "@/components/integrations/repo-connection-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProjectIntegrationsPanel({
  orgSlug,
  projectSlug,
  canManage,
  hasRepoConnection,
}: {
  orgSlug: string;
  projectSlug: string;
  canManage: boolean;
  hasRepoConnection: boolean;
}) {
  return (
    <Tabs className="grid gap-4" defaultValue="repository">
      <TabsList>
        <TabsTrigger value="repository">Repository</TabsTrigger>
        <TabsTrigger value="autofix">Autofix</TabsTrigger>
      </TabsList>

      <TabsContent className="mt-0 grid gap-6" value="repository">
        <p className="text-sm text-muted-foreground">
          GitHub App credentials are shared by every project and are managed in{" "}
          <Link
            className="font-medium text-primary-accent hover:underline"
            to={`/orgs/${orgSlug}?tab=settings&section=general`}
          >
            organization settings
          </Link>
          .
        </p>
        <RepoConnectionCard canManage={canManage} orgSlug={orgSlug} projectSlug={projectSlug} />
      </TabsContent>

      <TabsContent className="mt-0" value="autofix">
        <AutofixConfigCard
          canManage={canManage}
          hasConnection={hasRepoConnection}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
        />
      </TabsContent>
    </Tabs>
  );
}

export { ProjectIntegrationsPanel };
