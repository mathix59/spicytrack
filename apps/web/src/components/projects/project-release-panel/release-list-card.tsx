import { GitBranch, Plus } from "lucide-react";

import type { ProjectReleaseDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function ReleaseListCard({
  releases,
  selectedReleaseVersion,
  createOpen,
  createError,
  isCreatingRelease,
  onCreateOpenChange,
  onSelectRelease,
  onCreateRelease,
}: {
  releases: ProjectReleaseDto[];
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
            <Badge variant="muted">{releases.length}</Badge>
          </div>
          <Dialog onOpenChange={onCreateOpenChange} open={createOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">
                <Plus className="size-4" />
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
                <Field label="Version">
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
        {releases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-background">
              <GitBranch className="size-4 text-primary" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Ship your first release</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Create it here or send a <code className="text-foreground">release</code> field from
              your SDK.
            </p>
            <Button
              className="mt-4"
              onClick={() => onCreateOpenChange(true)}
              size="sm"
              type="button"
            >
              <Plus className="size-4" />
              Create release
            </Button>
          </div>
        ) : (
          releases.map((release) => (
            <button
              className={
                selectedReleaseVersion === release.version
                  ? "flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-md bg-accent px-3 py-2 text-left"
                  : "flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50"
              }
              key={release.id}
              onClick={() => onSelectRelease(release.version)}
              title={release.version}
              type="button"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{release.version}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {release.eventCount} events
              </span>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export { ReleaseListCard };
