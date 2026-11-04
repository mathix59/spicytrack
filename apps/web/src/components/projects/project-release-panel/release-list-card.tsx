import { useMemo } from "react";
import { GitBranch, Plus } from "lucide-react";

import type { ProjectReleaseDto, ReleaseHealthReleaseDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { QueryError } from "@/components/common/query-error";
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
import { SkeletonRows } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/pluralize";
import { cn, formatLocalDateTime, formatRelativeTime } from "@/lib/utils";

import { formatRate, healthVariant } from "./release-health-utils";
import { sortReleasesByLastSeen, splitReleaseVersion } from "./utils";

const HEALTH_DOT = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-border",
} as const;

function ReleaseListItem({
  release,
  health,
  selected,
  showHealth,
  onSelect,
}: {
  release: ProjectReleaseDto;
  health: ReleaseHealthReleaseDto | undefined;
  selected: boolean;
  showHealth: boolean;
  onSelect: () => void;
}) {
  const { packageName, version } = splitReleaseVersion(release.version);
  const crashFree = health?.crashFreeSessions ?? null;

  return (
    <li className="min-w-0">
      <button
        aria-current={selected ? "true" : undefined}
        className={cn(
          "grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 rounded-md px-3 py-2 text-left transition-colors",
          selected ? "bg-accent" : "hover:bg-accent/50",
        )}
        onClick={onSelect}
        title={release.version}
        type="button"
      >
        <GitBranch className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 items-baseline text-sm">
          {packageName ? (
            <span className="min-w-0 truncate text-muted-foreground">{packageName}</span>
          ) : null}
          <span className="max-w-full shrink-0 truncate font-semibold">{version}</span>
        </span>
        {showHealth ? (
          <span className="flex items-center justify-end gap-1.5 text-xs tabular-nums text-muted-foreground">
            {crashFree !== null && health ? (
              <>
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", HEALTH_DOT[healthVariant(crashFree)])}
                />
                <span className="sr-only">Crash-free sessions, last 7 days: </span>
                <span className="text-foreground">{formatRate(crashFree)}</span>
              </>
            ) : (
              <>
                <span className="sr-only">No sessions in the last 7 days</span>
                <span aria-hidden="true">—</span>
              </>
            )}
          </span>
        ) : (
          <span />
        )}
        <span className="col-start-2 col-end-4 truncate text-xs text-muted-foreground">
          {pluralize(release.eventCount, "event")}
          {release.lastSeenAt ? (
            <>
              {" "}
              · last seen{" "}
              <time dateTime={release.lastSeenAt} title={formatLocalDateTime(release.lastSeenAt)}>
                {formatRelativeTime(release.lastSeenAt)}
              </time>
            </>
          ) : null}
          {health && health.sessions > 0 ? ` · ${pluralize(health.sessions, "session")}` : null}
        </span>
      </button>
    </li>
  );
}

function ReleaseListCard({
  releases,
  isLoading,
  error,
  onRetry,
  healthByVersion,
  selectedReleaseVersion,
  createOpen,
  createError,
  isCreatingRelease,
  onCreateOpenChange,
  onSelectRelease,
  onCreateRelease,
}: {
  releases: ProjectReleaseDto[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  healthByVersion: Map<string, ReleaseHealthReleaseDto>;
  selectedReleaseVersion: string;
  createOpen: boolean;
  createError: string | null;
  isCreatingRelease: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onSelectRelease: (releaseVersion: string) => void;
  onCreateRelease: React.FormEventHandler<HTMLFormElement>;
}) {
  const sortedReleases = useMemo(() => sortReleasesByLastSeen(releases), [releases]);
  const hasHealth = healthByVersion.size > 0;

  return (
    <Card className="min-w-0 overflow-hidden" data-testid="release-list-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle>Releases</CardTitle>
            {isLoading ? null : <Badge variant="muted">{releases.length}</Badge>}
          </div>
          <Dialog onOpenChange={onCreateOpenChange} open={createOpen}>
            <DialogTrigger asChild>
              <Button size="sm" type="button" variant="secondary">
                <Plus />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New release</DialogTitle>
                <DialogDescription>
                  Create a release to attach artifacts before any event references it.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" onSubmit={onCreateRelease}>
                <Field hint="Must match the release your SDK reports." label="Version">
                  <Input name="version" placeholder="1.4.0" required />
                </Field>
                {createError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                ) : null}
                <FormDialogActions isPending={isCreatingRelease} submitLabel="Create" />
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-1">
        {isLoading ? (
          <SkeletonRows className="[&>*]:h-9" rows={4} />
        ) : error ? (
          <QueryError error={error} onRetry={onRetry} title="Could not load releases" />
        ) : releases.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={() => onCreateOpenChange(true)} size="sm" type="button">
                <Plus />
                Create release
              </Button>
            }
            description="Create a release here or send a release field from your SDK, then upload source maps."
            icon={GitBranch}
            title="Ship your first release"
          />
        ) : (
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-3 px-3 pb-1 text-xs text-muted-foreground">
              <span>Most recent first</span>
              {hasHealth ? <span>Crash-free (7d)</span> : null}
            </div>
            <ul className="grid gap-1">
              {sortedReleases.map((release) => (
                <ReleaseListItem
                  health={healthByVersion.get(release.version)}
                  key={release.id}
                  onSelect={() => onSelectRelease(release.version)}
                  release={release}
                  selected={selectedReleaseVersion === release.version}
                  showHealth={hasHealth}
                />
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ReleaseListCard };
