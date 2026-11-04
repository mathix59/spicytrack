import { RotateCcw } from "lucide-react";

import type { OrganizationJobDto } from "@/generated/api";
import { formatLocalDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

function OrganizationJobQueueTable({
  jobs,
  isRequeuePending,
  onRequeue,
}: {
  jobs: OrganizationJobDto[];
  isRequeuePending: boolean;
  onRequeue: (jobId: string) => void;
}) {
  return (
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
              <div className="truncate text-sm text-muted-foreground">{job.lastError ?? "—"}</div>
            </TableCell>
            <TableCell>
              <Button
                disabled={job.status !== "failed" || isRequeuePending}
                onClick={() => onRequeue(job.id)}
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
  );
}

export { OrganizationJobQueueTable };
