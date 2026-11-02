import type { FormEvent, ReactNode } from "react";

import type { ProjectKeyDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
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

import { ProjectKeyError } from "./project-key-error";

const RATE_LIMIT_HINT = "Maximum events accepted per minute. Leave empty for no limit.";

function CreateProjectKeyDialog({
  open,
  error,
  isPending,
  trigger,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  error: string | null;
  isPending: boolean;
  trigger: ReactNode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New key</DialogTitle>
          <DialogDescription>
            Generate a public key to start receiving envelopes from SDKs.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
          <Field label="Key name">
            <Input name="name" placeholder="Production web" required />
          </Field>
          <Field hint={RATE_LIMIT_HINT} label="Rate limit / minute">
            <Input min="0" name="rateLimitPerMinute" type="number" />
          </Field>
          <ProjectKeyError error={error} />
          <FormDialogActions isPending={isPending} submitLabel="Create key" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageProjectKeyDialog({
  keyData,
  open,
  error,
  isPending,
  onOpenChange,
  onSubmit,
}: {
  keyData: ProjectKeyDto;
  open: boolean;
  error: string | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage key</DialogTitle>
          <DialogDescription>
            Update this key&apos;s name, ingestion status, or rate limit.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
          <Field label="Key name">
            <Input defaultValue={keyData.name} name="name" required />
          </Field>
          <Field hint={RATE_LIMIT_HINT} label="Rate limit / minute">
            <Input
              defaultValue={keyData.rateLimitPerMinute ?? ""}
              min="0"
              name="rateLimitPerMinute"
              type="number"
            />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/15 px-3 py-2.5 text-sm">
            <span>
              <span className="block font-medium">Accept events</span>
              <span className="block text-xs text-muted-foreground">
                Disable to stop ingestion without deleting the key.
              </span>
            </span>
            <input defaultChecked={keyData.isActive} name="isActive" type="checkbox" />
          </label>
          <ProjectKeyError error={error} />
          <FormDialogActions isPending={isPending} submitLabel="Save changes" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateProjectKeyDialog, ManageProjectKeyDialog };
