import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Workflow } from "lucide-react";

import {
  getGetOrganizationJobQueueOverviewQueryKey,
  type GetOrganizationJobQueueOverviewParams,
  type JobQueueSummaryDto,
  useGetOrganizationJobQueueOverview,
  useRequeueOrganizationJob,
} from "@/generated/api";
import { formatLocalDateTime, getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type OrganizationJobFilters = {
  status: "" | "pending" | "running" | "failed";
  type: string;
  projectId: string;
  limit: string;
};

const DEFAULT_FILTERS: OrganizationJobFilters = {
  status: "",
  type: "",
  projectId: "",
  limit: "25",
};

function statusVariant(status: string) {
  if (status === "failed") {
    return "default";
  }

  if (status === "running") {
    return "accent";
  }

  return "muted";
}

function summarizePayload(payload: Record<string, unknown>) {
  const entries = Object.entries(payload).slice(0, 2);

  if (entries.length === 0) {
    return "No payload";
  }

  return entries
    .map(([key, value]) => `${key}:${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

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
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Status">
            <Select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as OrganizationJobFilters["status"],
                }))
              }
              value={filters.status}
            >
              <option value="">Any active/failed</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="failed">Failed</option>
            </Select>
          </Field>
          <Field label="Type">
            <Input
              onChange={(event) =>
                setFilters((current) => ({ ...current, type: event.target.value }))
              }
              placeholder="autofix"
              value={filters.type}
            />
          </Field>
          <Field label="Project ID">
            <Input
              onChange={(event) =>
                setFilters((current) => ({ ...current, projectId: event.target.value }))
              }
              placeholder="uuid"
              value={filters.projectId}
            />
          </Field>
          <Field label="Limit">
            <Select
              onChange={(event) =>
                setFilters((current) => ({ ...current, limit: event.target.value }))
              }
              value={filters.limit}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </Field>
        </div>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Run at</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="font-medium">{job.type}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {job.projectId ?? "No project"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[18rem]">
                    <div className="truncate text-sm">{summarizePayload(job.payload)}</div>
                    {job.dedupeKey ? (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        dedupe: {job.dedupeKey}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>{job.attempts}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatLocalDateTime(job.runAt)}
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    <div className="truncate text-sm text-muted-foreground">
                      {job.lastError ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      disabled={job.status !== "failed" || requeueMutation.isPending}
                      onClick={async () => {
                        setError(null);

                        try {
                          await requeueMutation.mutateAsync({ orgSlug, jobId: job.id });
                        } catch (mutationError) {
                          setError(getErrorMessage(mutationError));
                        }
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <RotateCcw className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export { OrganizationJobQueueCard };
