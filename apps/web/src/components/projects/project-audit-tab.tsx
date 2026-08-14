import { useMemo } from "react";

import { useListProjectAudit, type OrganizationMemberDto } from "@/generated/api";
import { formatLocalDateTime, renderNullableText } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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
  const entries = auditQuery.data?.data ?? [];
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Audit log</CardTitle>
          <Badge variant="muted">{entries.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {entries.length === 0 ? (
          <EmptyState
            description="Key rotations, project changes, assignments, and other sensitive actions will appear here."
            title="No audit entries"
          />
        ) : (
          entries.map((entry) => {
            const actor = entry.actorUserId ? memberByUserId.get(entry.actorUserId) : null;
            return (
              <div className="rounded-lg border border-border bg-muted/20 p-4" key={entry.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.actorUserId
                        ? renderNullableText(actor?.name, actor?.email ?? entry.actorUserId)
                        : "system"}{" "}
                      · {formatLocalDateTime(entry.createdAt)}
                    </p>
                  </div>
                  <Badge variant="accent">{entry.targetType}</Badge>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-foreground">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export { ProjectAuditTab };
