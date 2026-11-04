import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Workflow } from "lucide-react";

import {
  getGetOrganizationJobQueueOverviewQueryKey,
  type GetOrganizationJobQueueOverviewParams,
  type JobQueueSummaryDto,
  useGetOrganizationJobQueueOverview,
  useRequeueOrganizationJob,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import {
  OrganizationJobQueueFilters,
  type OrganizationJobFilters,
} from "./organization-job-queue-filters";
import { OrganizationJobQueueTable } from "./organization-job-queue-table";

const DEFAULT_FILTERS: OrganizationJobFilters = {
  status: "",
  type: "",
  projectId: "",
  limit: "25",
};

function SummaryBadge({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "default" | "accent" | "muted";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}

function OrganizationJobQueueCard({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<OrganizationJobFilters>(DEFAULT_FILTERS);
  const [error, setError] = useState<string | null>(null);

  const queueParams: GetOrganizationJobQueueOverviewParams = {
    limit: filters.limit,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
  };

  const queueQuery = useGetOrganizationJobQueueOverview(orgSlug, queueParams, {
    query: { enabled: canManage },
  });

  const requeueMutation = useRequeueOrganizationJob({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetOrganizationJobQueueOverviewQueryKey(orgSlug),
        });
      },
    },
  });

  const requeueJob = async (jobId: string) => {
    setError(null);

    try {
      await requeueMutation.mutateAsync({ orgSlug, jobId });
    } catch (mutationError) {
      setError(getErrorMessage(mutationError));
    }
  };
  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Job queue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only organization owners and admins can inspect and requeue background jobs.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overview = queueQuery.data?.data;
  const jobs = overview?.jobs ?? [];
  const summary: JobQueueSummaryDto | undefined = overview?.summary;

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Job queue</CardTitle>
          <Button
            disabled={queueQuery.isFetching}
            onClick={() => {
              setError(null);
              void queueQuery.refetch();
            }}
            type="button"
            variant="ghost"
          >
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Inspect queued, running, and failed ingest/admin jobs for this organization.
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryBadge label="Pending" value={summary?.pending ?? 0} variant="muted" />
          <SummaryBadge label="Running" value={summary?.running ?? 0} variant="accent" />
          <SummaryBadge label="Failed" value={summary?.failed ?? 0} variant="default" />
          <SummaryBadge label="Due now" value={summary?.due ?? 0} variant="muted" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <OrganizationJobQueueFilters filters={filters} setFilters={setFilters} />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {queueQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(queueQuery.error)}</AlertDescription>
          </Alert>
        ) : null}

        {queueQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading job queue…</p>
        ) : null}

        {jobs.length === 0 && !queueQuery.isLoading ? (
          <EmptyState
            description="No queued, running, or failed jobs match the current filters."
            icon={Workflow}
            title="Queue is clear"
          />
        ) : (
          <OrganizationJobQueueTable
            isRequeuePending={requeueMutation.isPending}
            jobs={jobs}
            onRequeue={(jobId) => void requeueJob(jobId)}
          />
        )}
      </CardContent>
    </Card>
  );
}

export { OrganizationJobQueueCard };
