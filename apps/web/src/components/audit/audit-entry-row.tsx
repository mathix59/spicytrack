import { KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AuditEntryDto } from "@/generated/api";
import { formatLocalDateTime, formatRelativeTime } from "@/lib/utils";

function hasPayload(payload: unknown) {
  return Boolean(payload && typeof payload === "object" && Object.keys(payload).length > 0);
}

function actorLabel(entry: AuditEntryDto) {
  if (entry.actorName || entry.actorEmail) return entry.actorName ?? entry.actorEmail;
  return entry.actorUserId ? "Deleted user" : "System";
}

function AuditEntryRow({ entry, showProject }: { entry: AuditEntryDto; showProject: boolean }) {
  return (
    <li className="min-w-0 border-b border-border p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium [overflow-wrap:anywhere]">{entry.action}</p>
          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            <span className="text-foreground">{actorLabel(entry)}</span>
            {entry.actorEmail && entry.actorName ? ` (${entry.actorEmail})` : null} ·{" "}
            <time dateTime={entry.createdAt} title={formatLocalDateTime(entry.createdAt)}>
              {formatRelativeTime(entry.createdAt)}
            </time>
            {entry.ipAddress ? ` · ${entry.ipAddress}` : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {entry.actorTokenId ? (
            <Badge title="Performed with a personal access token" variant="info">
              <KeyRound className="size-3" />
              {entry.actorTokenName ?? "Revoked token"}
            </Badge>
          ) : null}
          {showProject && entry.projectName ? (
            <Badge variant="muted">{entry.projectName}</Badge>
          ) : null}
          <Badge variant="accent">{entry.targetType}</Badge>
        </div>
      </div>
      {hasPayload(entry.payload) || entry.userAgent || entry.targetId ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Details
          </summary>
          <dl className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-x-3">
            <dt>Time</dt>
            <dd className="text-foreground">{formatLocalDateTime(entry.createdAt)}</dd>
            {entry.targetId ? (
              <>
                <dt>Target</dt>
                <dd className="font-mono text-foreground [overflow-wrap:anywhere]">
                  {entry.targetId}
                </dd>
              </>
            ) : null}
            {entry.userAgent ? (
              <>
                <dt>User agent</dt>
                <dd className="text-foreground [overflow-wrap:anywhere]">{entry.userAgent}</dd>
              </>
            ) : null}
          </dl>
          {hasPayload(entry.payload) ? (
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted/30 px-3 py-2 font-mono text-[11px] text-foreground">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          ) : null}
        </details>
      ) : null}
    </li>
  );
}

export { AuditEntryRow };
