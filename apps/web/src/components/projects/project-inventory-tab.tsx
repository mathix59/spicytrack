import { RadioTower } from "lucide-react";

import type { ProjectEnvironmentDto, ProjectReleaseDto } from "@/generated/api";
import { cn } from "@/lib/utils";
import { ProjectReleasePanel } from "@/components/projects/project-release-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProjectInventoryTab({
  environments,
  onOpenIssue,
  onSelectRelease,
  orgSlug,
  projectSlug,
  releases,
  selectedReleaseVersion,
}: {
  environments: ProjectEnvironmentDto[];
  onOpenIssue: (issueId: string) => void;
  onSelectRelease: (version: string) => void;
  orgSlug: string;
  projectSlug: string;
  releases: ProjectReleaseDto[];
  selectedReleaseVersion: string;
}) {
  return (
    <Tabs className="grid gap-4" defaultValue="releases">
      <TabsList className="w-fit">
        <TabsTrigger value="releases">Releases</TabsTrigger>
        <TabsTrigger value="environments">Environments</TabsTrigger>
      </TabsList>
      <TabsContent className="mt-0" value="releases">
        <ProjectReleasePanel
          onOpenIssue={onOpenIssue}
          onSelectRelease={onSelectRelease}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          releases={releases}
          selectedReleaseVersion={selectedReleaseVersion}
        />
      </TabsContent>
      <TabsContent className="mt-0" value="environments">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Environments</CardTitle>
              <Badge variant="muted">{environments.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {environments.length === 0 ? (
              <div className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/10 p-5">
                <RadioTower className="size-5 text-primary" />
                <div>
                  <p className="font-medium">Waiting for the first environment</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Send{" "}
                    <code className="text-foreground">environment: &quot;production&quot;</code>{" "}
                    with an event to start separating traffic.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                {environments.map((environment, index) => (
                  <div
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5",
                      index > 0 && "border-t border-border",
                    )}
                    key={environment.id}
                  >
                    <p className="text-sm font-medium">{environment.name}</p>
                    <p className="text-xs text-muted-foreground">{environment.eventCount} events</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

export { ProjectInventoryTab };
