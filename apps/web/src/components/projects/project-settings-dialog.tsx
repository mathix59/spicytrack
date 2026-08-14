import type { FormEvent } from "react";
import { Settings } from "lucide-react";

import type { ProjectDto, TeamDto } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { ProjectSettingsFields } from "./project-settings-dialog/settings-fields";

interface ProjectSettingsDialogProps {
  error: string | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  project: ProjectDto;
  teams: TeamDto[];
}

function ProjectSettingsDialog({
  error,
  isSaving,
  onOpenChange,
  onSubmit,
  open,
  project,
  teams,
}: ProjectSettingsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Settings className="size-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>
            Rename the project, change its platform, visibility, owning team, or retention window.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <ProjectSettingsFields project={project} teams={teams} />
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormDialogActions isPending={isSaving} submitLabel="Save project" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ProjectSettingsDialog };
