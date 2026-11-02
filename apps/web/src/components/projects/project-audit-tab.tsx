import { useMemo } from "react";
import { ScrollText } from "lucide-react";

import { type AuditLogDto, type OrganizationMemberDto, useListProjectAudit } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDateTime, renderNullableText } from "@/lib/utils";

const EMPTY_ENTRIES: AuditLogDto[] = [];

function hasPayload(payload: unknown) {
  return Boolean(payload && typeof payload === "object" && Object.keys(payload).length > 0);
}

function ProjectAuditTab({
  members,
  orgSlug,
  projectSlug,
}: {
  members: OrganizationMemberDto[];
  orgSlug: string;
  projectSlug: string;
}) {
  const auditQuery = useListProjectAudit(orgSlug, projectSlug);
  const entries = auditQuery.data?.data ?? EMPTY_ENTRIES;
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Audit log</CardTitle>
            <CardDescription>
              Who changed keys, settings and other sensitive project configuration, and when.
            </CardDescription>
          </div>
          {auditQuery.isLoading ? null : <Badge variant="muted">{entries.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {auditQuery.isLoading ? (
          <SkeletonRows rows={5} />
        ) : auditQuery.error ? (
          <QueryError
            error={auditQuery.error}
            onRetry={() => void auditQuery.refetch()}
            title="Could not load the audit log"
          />
        ) : entries.length === 0 ? (
          <EmptyState
            description="Key rotations, project changes, assignments, and other sensitive actions will appear here."
            icon={ScrollText}
            title="No audit entries"
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {entries.map((entry) => {
              const actor = entry.actorUserId ? memberByUserId.get(entry.actorUserId) : null;
              const actorLabel = entry.actorUserId
                ? renderNullableText(actor?.name, actor?.email ?? entry.actorUserId)
                : "system";
              return (
                <li className="min-w-0 border-b border-border p-4 last:border-b-0" key={entry.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium [overflow-wrap:anywhere]">
                        {entry.action}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {actorLabel} · {formatLocalDateTime(entry.createdAt)}
                      </p>
                    </div>
                    <Badge className="shrink-0" variant="accent">
                      {entry.targetType}
                    </Badge>
                  </div>
                  {hasPayload(entry.payload) ? (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Details
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/30 px-3 py-2 font-mono text-[11px] text-foreground">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { ProjectAuditTab };
