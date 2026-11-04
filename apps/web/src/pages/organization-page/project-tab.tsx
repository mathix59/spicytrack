import { Plus } from "lucide-react";

import { useGetOrganizationOverview } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { QueryError } from "@/components/common/query-error";
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";

import { ProjectOverviewRow } from "../dashboard-page/project-overview-row";
import type { OrganizationProjectsState } from "./types";

function OrganizationProjectTab({
  orgSlug,
  state,
}: {
  orgSlug: string;
  state: OrganizationProjectsState;
}) {
  // Same query (and cache) as the dashboard: 24h events, open issues and the 14-day trend.
  const overviewQuery = useGetOrganizationOverview(orgSlug);
  const statsByProjectId = new Map(
    (overviewQuery.data?.data.projects ?? []).map((project) => [project.id, project]),
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Projects</CardTitle>
            {state.projectsStatus.isLoading ? null : (
              <Badge variant="muted">{state.projects.length}</Badge>
            )}
          </div>
          {state.canManageProjects ? (
            <Dialog onOpenChange={state.setProjectOpen} open={state.projectOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  New project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New project</DialogTitle>
                  <DialogDescription>
                    A project holds the DSN, issues, and events for one SDK integration.
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={state.createProject}>
                  <Field label="Project name">
                    <Input name="name" required />
                  </Field>
                  <Field label="Platform">
                    <Select defaultValue="javascript" name="platform">
                      {PLATFORM_OPTIONS.map((platform) => (
                        <option key={platform.value} value={platform.value}>
                          {platform.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Visibility">
                    <Select defaultValue="private" name="visibility">
                      <option value="private">private</option>
                      <option value="internal">internal</option>
                    </Select>
                  </Field>
                  <Field label="Owning team">
                    <Select defaultValue="" name="teamId">
                      <option value="">None</option>
                      {state.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {state.projectError ? (
                    <Alert variant="destructive">
                      <AlertDescription>{state.projectError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <FormDialogActions
                    isPending={state.isCreatingProject}
                    submitLabel="Create project"
                  />
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {state.projectsStatus.isLoading ? (
          <SkeletonRows rows={3} />
        ) : state.projectsStatus.error ? (
          <QueryError
            error={state.projectsStatus.error}
            onRetry={state.projectsStatus.refetch}
            title="Could not load projects"
          />
        ) : state.projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project to get a DSN and start receiving events."
          />
        ) : (
          <ul className="-mx-3 grid">
            {state.projects.map((project) => (
              <ProjectOverviewRow
                key={project.id}
                orgSlug={orgSlug}
                project={project}
                stats={statsByProjectId.get(project.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { OrganizationProjectTab };
