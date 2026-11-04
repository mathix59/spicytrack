import { Link, useSearchParams } from "react-router-dom";

import { AutofixConfigCard } from "@/components/integrations/autofix-config-card";
import { RepoConnectionCard } from "@/components/integrations/repo-connection-card";
import { TicketTrackersCard } from "@/components/tickets/ticket-trackers-card";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("integration");
  // Driven by the URL so in-page links (e.g. Autofix → Repository) switch the tab.
  const active = requested === "tickets" || requested === "autofix" ? requested : "repository";
  const integrationHref = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("integration", value);
    return `?${next.toString()}`;
  };

  return (
    <Tabs
      className="grid gap-4"
      onValueChange={(value) =>
        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.set("integration", value);
            return next;
          },
          { replace: true },
        )
      }
      value={active}
    >
      <TabsList>
        <TabsTrigger value="repository">Repository</TabsTrigger>
        <TabsTrigger value="autofix">Autofix</TabsTrigger>
        <TabsTrigger value="tickets">Tickets</TabsTrigger>
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
          repositoryHref={integrationHref("repository")}
        />
      </TabsContent>

      <TabsContent className="mt-0" value="tickets">
        <TicketTrackersCard canManage={canManage} orgSlug={orgSlug} projectSlug={projectSlug} />
      </TabsContent>
    </Tabs>
  );
}

export { ProjectIntegrationsPanel };
