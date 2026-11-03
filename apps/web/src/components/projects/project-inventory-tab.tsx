import { RadioTower } from "lucide-react";

import {
  type ProjectEnvironmentDto,
  type ProjectReleaseDto,
  useListProjectEnvironments,
  useListProjectReleases,
} from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { ProjectReleasePanel } from "@/components/projects/project-release-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLocalDateTime } from "@/lib/utils";

const EMPTY_ENVIRONMENTS: ProjectEnvironmentDto[] = [];
const EMPTY_RELEASES: ProjectReleaseDto[] = [];

function EnvironmentsCard({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  // Shares the cache entry the project page already loads, so this adds no request.
  const environmentsQuery = useListProjectEnvironments(orgSlug, projectSlug);
  const environments = environmentsQuery.data?.data ?? EMPTY_ENVIRONMENTS;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Environments</CardTitle>
            <CardDescription>
              Environments reported by your SDKs, with event volume.
            </CardDescription>
          </div>
          {environmentsQuery.isLoading ? null : (
            <Badge variant="muted">{environments.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {environmentsQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : environmentsQuery.error ? (
          <QueryError
            error={environmentsQuery.error}
            onRetry={() => void environmentsQuery.refetch()}
            title="Could not load environments"
          />
        ) : environments.length === 0 ? (
          <EmptyState
            description='Send environment: "production" (or any name) with an event to start separating traffic.'
            icon={RadioTower}
            title="Waiting for the first environment"
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {environments.map((environment) => (
              <li
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                key={environment.id}
              >
                <p className="min-w-0 truncate text-sm font-medium">{environment.name}</p>
                <p className="shrink-0 text-right text-xs text-muted-foreground">
                  {environment.eventCount} events
                  {environment.lastSeenAt ? (
                    <span className="hidden sm:inline">
                      {" "}
                      · last seen {formatLocalDateTime(environment.lastSeenAt)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectInventoryTab({
  onOpenIssue,
  onSelectRelease,
  orgSlug,
  projectSlug,
  selectedReleaseVersion,
}: {
  onOpenIssue: (issueId: string) => void;
  onSelectRelease: (version: string) => void;
  orgSlug: string;
  projectSlug: string;
  selectedReleaseVersion: string;
}) {
  // Shares the cache entry the project page already loads, so this adds no request.
  const releasesQuery = useListProjectReleases(orgSlug, projectSlug);

  return (
    <Tabs className="grid gap-4" defaultValue="releases">
      <TabsList>
        <TabsTrigger value="releases">Releases</TabsTrigger>
        <TabsTrigger value="environments">Environments</TabsTrigger>
      </TabsList>
      <TabsContent className="mt-0" value="releases">
        <ProjectReleasePanel
          onOpenIssue={onOpenIssue}
          onSelectRelease={onSelectRelease}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          releases={releasesQuery.data?.data ?? EMPTY_RELEASES}
          releasesError={releasesQuery.error}
          releasesLoading={releasesQuery.isLoading}
          retryReleases={() => void releasesQuery.refetch()}
          selectedReleaseVersion={selectedReleaseVersion}
        />
      </TabsContent>
      <TabsContent className="mt-0" value="environments">
        <EnvironmentsCard orgSlug={orgSlug} projectSlug={projectSlug} />
      </TabsContent>
    </Tabs>
  );
}

export { ProjectInventoryTab };
