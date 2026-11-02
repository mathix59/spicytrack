import type { FormEvent } from "react";
import { KeyRound } from "lucide-react";

import type { ProjectDto } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { DEFAULT_SCOPE_COUNT, MCP_SCOPES } from "./mcp-api";

function CreateMcpKeyDialog({
  open,
  onOpenChange,
  projects,
  error,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectDto[];
  error: string | null;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create MCP key</DialogTitle>
          <DialogDescription>
            This key can only read the scopes and projects selected below.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Field label="Name">
            <Input name="name" placeholder="Production triage" required />
          </Field>
          <Field hint="Leave empty for a key without expiry." label="Expires in days">
            <Input min="1" max="365" name="expiresInDays" type="number" />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Access</legend>
            {MCP_SCOPES.map(([scope, label], index) => (
              <label className="flex items-center gap-2 text-sm" key={scope}>
                <input defaultChecked={index < DEFAULT_SCOPE_COUNT} name={scope} type="checkbox" />
                {label}
                {index >= DEFAULT_SCOPE_COUNT ? (
                  <span className="text-xs text-warning">write</span>
                ) : null}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Projects</legend>
            <label className="flex items-center gap-2 text-sm">
              <input defaultChecked name="allProjects" type="checkbox" />
              All current and future projects
            </label>
            <div className="grid max-h-32 gap-1 overflow-y-auto pl-5">
              {projects.map((project) => (
                <label
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  key={project.id}
                >
                  <input name={`project:${project.id}`} type="checkbox" />
                  {project.name}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={isPending} type="submit">
              <KeyRound className="size-4" />
              {isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateMcpKeyDialog };
