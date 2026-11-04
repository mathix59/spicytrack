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
import { cn } from "@/lib/utils";

import { formatRate, healthVariant } from "./release-health-utils";

const HEALTH_DOT = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-border",
} as const;

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
          <ul className="grid gap-1">
            {releases.map((release) => {
              const selected = selectedReleaseVersion === release.version;
              const health = healthByVersion.get(release.version);
              return (
                <li className="min-w-0" key={release.id}>
                  <button
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-md px-3 py-2 text-left transition-colors",
                      selected ? "bg-accent" : "hover:bg-accent/50",
                    )}
                    onClick={() => onSelectRelease(release.version)}
                    title={release.version}
                    type="button"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{release.version}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {health?.crashFreeSessions != null ? (
                        <span
                          className="flex items-center gap-1 tabular-nums"
                          title={`Crash-free sessions, last 7 days (${health.sessions.toLocaleString()} sessions)`}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "size-2 rounded-full",
                              HEALTH_DOT[healthVariant(health.crashFreeSessions)],
                            )}
                          />
                          <span className="sr-only">Crash-free sessions </span>
                          {formatRate(health.crashFreeSessions)}
                          <span aria-hidden="true" className="ml-1">
                            ·
                          </span>
                        </span>
                      ) : null}
                      {release.eventCount} events
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { ReleaseListCard };
