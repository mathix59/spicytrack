import { useState } from "react";
import type { FormEvent } from "react";
import { Activity, ArrowRight, LayoutGrid, Plus, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  getGetMeQueryKey,
  getListOrganizationsQueryKey,
  useCreateOrganization,
  useGetOrganizationOverview,
  useListOrganizations,
  type OrganizationListItemDto,
} from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { runAsyncFormAction } from "@/lib/form-submission";
import { slugify } from "@/lib/slug";
import { PageHeader } from "@/components/common/page-header";
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

function DashboardPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const organizationsQuery = useListOrganizations();
  const createOrganizationMutation = useCreateOrganization({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListOrganizationsQueryKey(),
        });
        await queryClient.invalidateQueries({
          queryKey: getGetMeQueryKey(),
        });
      },
    },
  });

  const organizations = organizationsQuery.data?.data ?? [];
  const canCreateOrganization =
    organizations.length === 0 ||
    organizations.some((organization) => organization.role === "owner");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");

    await runAsyncFormAction({
      setError,
      action: () =>
        createOrganizationMutation.mutateAsync({
          data: {
            name,
            slug: slugify(name),
          },
        }),
      onSuccess: async () => {
        setOpen(false);
      },
    });
  };

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Dashboard"
        icon={LayoutGrid}
        title="Organizations"
        actions={
          canCreateOrganization ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  New organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New organization</DialogTitle>
                  <DialogDescription>
                    Organizations group members, teams, and projects together.
                  </DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={submit}>
                  <Field label="Name">
                    <Input name="name" required />
                  </Field>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <FormDialogActions
                    isPending={createOrganizationMutation.isPending}
                    submitLabel="Create organization"
                  />
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="No organizations yet"
              description="Create your first organization, accept an invitation sent to your verified email, or ask the administrator whether secure SSO auto-join is enabled."
            />
          </CardContent>
        </Card>
      ) : (
        organizations.map((organization) => (
          <OrganizationCard key={organization.id} organization={organization} />
        ))
      )}
    </section>
  );
}

function OrganizationCard({ organization }: { organization: OrganizationListItemDto }) {
  const overviewQuery = useGetOrganizationOverview(organization.slug);
  const overview = overviewQuery.data?.data;
  const projects = overview?.projects ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle>
              <Link
                className="transition-colors hover:text-primary"
                to={`/orgs/${organization.slug}`}
              >
                {organization.name}
              </Link>
            </CardTitle>
            <Badge variant="muted">{organization.role}</Badge>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/orgs/${organization.slug}`}>
              Open
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {overview ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="muted">
              <Activity className="mr-1 size-3" />
              {overview.eventCount24h} events / 24h
            </Badge>
            <Badge variant="muted">{overview.openIssueCount} open</Badge>
            <Badge variant={overview.regressedIssueCount > 0 ? "accent" : "muted"}>
              <RotateCcw className="mr-1 size-3" />
              {overview.regressedIssueCount} regressions
            </Badge>
          </div>
        ) : null}

        {overview?.topRegressions.length ? (
          <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Top regressions
            </p>
            {overview.topRegressions.map((issue) => (
              <Link
                className="flex items-center justify-between gap-3 text-sm hover:text-primary"
                key={issue.id}
                to={`/orgs/${organization.slug}/projects/${issue.projectSlug}/issues/${issue.id}`}
              >
                <span className="truncate">{issue.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {issue.timesSeen} events
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link
                className="group flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40"
                key={project.id}
                to={`/orgs/${organization.slug}/projects/${project.slug}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{project.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.platform}
                    {project.openIssueCount > 0 ? ` · ${project.openIssueCount} open issues` : ""}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { DashboardPage };
