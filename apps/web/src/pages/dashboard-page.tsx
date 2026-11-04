import { useState } from "react";
import type { FormEvent } from "react";
import { Building2, LayoutGrid, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  getGetMeQueryKey,
  getListOrganizationsQueryKey,
  useCreateOrganization,
  useListOrganizations,
} from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { runAsyncFormAction } from "@/lib/form-submission";
import { slugify } from "@/lib/slug";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";

import { OrganizationOverviewCard } from "./dashboard-page/organization-overview-card";

function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
    const slug = slugify(name);

    await runAsyncFormAction({
      setError,
      action: () =>
        createOrganizationMutation.mutateAsync({
          data: {
            name,
            slug,
          },
        }),
      onSuccess: async () => {
        setOpen(false);
        toast.success(`Organization "${name}" created`);
        navigate(`/orgs/${slug}`);
      },
    });
  };

  return (
    <section className="grid gap-6">
      <PageHeader
        eyebrow="Dashboard"
        icon={LayoutGrid}
        title="Overview"
        actions={
          canCreateOrganization ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
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

      {organizationsQuery.isLoading ? (
        <div aria-busy="true" aria-label="Loading organizations" className="grid gap-6">
          {[0, 1].map((index) => (
            <Card key={index}>
              <CardContent className="grid gap-4 pt-6">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : organizationsQuery.isError ? (
        <QueryError
          error={organizationsQuery.error}
          onRetry={() => void organizationsQuery.refetch()}
          title="Could not load your organizations"
        />
      ) : organizations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Building2}
              title="No organizations yet"
              description="Create your first organization, accept an invitation sent to your verified email, or ask the administrator whether secure SSO auto-join is enabled."
            />
          </CardContent>
        </Card>
      ) : (
        organizations.map((organization) => (
          <OrganizationOverviewCard key={organization.id} organization={organization} />
        ))
      )}
    </section>
  );
}

export { DashboardPage };
