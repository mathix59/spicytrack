import { ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { FormDialogActions } from "@/components/common/form-dialog-actions";
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

import type { OrganizationProjectsState } from "./types";

function OrganizationProjectTab({
  orgSlug,
  state,
}: {
  orgSlug: string;
  state: OrganizationProjectsState;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Projects</CardTitle>
            <Badge variant="muted">{state.projects.length}</Badge>
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
        {state.projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project to get a DSN and start receiving events."
          />
        ) : (
          <div className="grid gap-2">
            {state.projects.map((project) => (
              <Link
                className="group flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
                key={project.id}
                to={`/orgs/${orgSlug}/projects/${project.slug}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {project.platform} · {project.visibility}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="muted">{project.status}</Badge>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { OrganizationProjectTab };
