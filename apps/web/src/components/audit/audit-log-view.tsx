import { Download, KeyRound, ScrollText } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import type { AuditEntryDto } from "@/generated/api";
import { formatLocalDateTime, formatRelativeTime } from "@/lib/utils";

import { type AuditLogSource, useAuditLog } from "./use-audit-log";

type Option = { id: string; label: string };

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

/** Filterable, paginated and exportable audit log, for an organization or the instance. */
function AuditLogView({
  source,
  description,
  actors,
  projects,
}: {
  source: AuditLogSource;
  description: string;
  actors?: Option[];
  projects?: Option[];
}) {
  const state = useAuditLog(source);
  const { query, entries, filters } = state;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <CardTitle>Audit log</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="shrink-0"
                disabled={state.isExporting}
                size="sm"
                type="button"
                variant="outline"
              >
                <Download />
                {state.isExporting ? "Exporting…" : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void state.exportLog("csv")}>
                CSV (spreadsheets)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void state.exportLog("json")}>
                JSON (SIEM, scripts)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Field label="Action">
            <Select
              onChange={(event) => state.setFilter("action", event.target.value)}
              value={filters.action}
            >
              <option value="">All actions</option>
              {state.actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          {actors ? (
            <Field label="Actor">
              <Select
                onChange={(event) => state.setFilter("actorUserId", event.target.value)}
                value={filters.actorUserId}
              >
                <option value="">Anyone</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {projects ? (
            <Field label="Project">
              <Select
                onChange={(event) => state.setFilter("projectId", event.target.value)}
                value={filters.projectId}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Target">
            <Select
              onChange={(event) => state.setFilter("targetType", event.target.value)}
              value={filters.targetType}
            >
              <option value="">Any target</option>
              {state.targetTypes.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {targetType}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <Input
              max={filters.to || undefined}
              onChange={(event) => state.setFilter("from", event.target.value)}
              type="date"
              value={filters.from}
            />
          </Field>
          <Field label="To">
            <Input
              min={filters.from || undefined}
              onChange={(event) => state.setFilter("to", event.target.value)}
              type="date"
              value={filters.to}
            />
          </Field>
        </div>

        {query.isPending ? (
          <SkeletonRows rows={5} />
        ) : query.isError ? (
          <QueryError
            error={query.error}
            onRetry={() => void query.refetch()}
            title="Could not load the audit log"
          />
        ) : entries.length === 0 ? (
          <EmptyState
            action={
              state.isFiltered ? (
                <Button onClick={state.clearFilters} size="sm" type="button" variant="outline">
                  Clear filters
                </Button>
              ) : undefined
            }
            description={
              state.isFiltered
                ? "No entry matches these filters."
                : "Member, role, key, settings and other sensitive changes will appear here."
            }
            icon={ScrollText}
            title="No audit entries"
          />
        ) : (
          <>
            <ul className="overflow-hidden rounded-lg border border-border">
              {entries.map((entry) => (
                <AuditEntryRow entry={entry} key={entry.id} showProject={Boolean(projects)} />
              ))}
            </ul>
            {query.hasNextPage ? (
              <Button
                className="justify-self-center"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
                type="button"
                variant="outline"
              >
                {query.isFetchingNextPage ? "Loading…" : "Load older entries"}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { AuditLogView };
