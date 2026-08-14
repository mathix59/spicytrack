import type { FormEvent } from "react";
import { KeyRound, Plus } from "lucide-react";

import type { ProjectKeyDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { CopyableCode } from "@/components/projects/sdk-snippets";
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

import { ProjectKeyError } from "./project-key-error";

function ProjectKeyListCard({
  keys,
  primaryKeyId,
  error,
  createOpen,
  managedKey,
  isCreating,
  isUpdating,
  isRotating,
  onCreateOpenChange,
  onManagedKeyChange,
  onCreateKey,
  onSaveKey,
  onToggleKey,
  onRotateKey,
  onResetError,
}: {
  keys: ProjectKeyDto[];
  primaryKeyId: string | undefined;
  error: string | null;
  createOpen: boolean;
  managedKey: ProjectKeyDto | null;
  isCreating: boolean;
  isUpdating: boolean;
  isRotating: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onManagedKeyChange: (key: ProjectKeyDto | null) => void;
  onCreateKey: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSaveKey: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleKey: (key: ProjectKeyDto, isActive: boolean) => Promise<void>;
  onRotateKey: (keyId: string) => Promise<void>;
  onResetError: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle>Keys / DSN</CardTitle>
            <KeyRound className="size-4 text-muted-foreground" />
          </div>
          <Dialog onOpenChange={onCreateOpenChange} open={createOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" /> New key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New key</DialogTitle>
                <DialogDescription>
                  Generate a public key to start receiving envelopes from SDKs.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" onSubmit={(event) => void onCreateKey(event)}>
                <Field label="Key name">
                  <Input name="name" required />
                </Field>
                <Field label="Rate limit / minute">
                  <Input min="0" name="rateLimitPerMinute" type="number" />
                </Field>
                <ProjectKeyError error={error} />
                <FormDialogActions isPending={isCreating} submitLabel="Create key" />
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {keys.length === 0 ? (
          <EmptyState
            description="Generate a public key to start receiving envelopes from SDKs."
            title="No keys"
          />
        ) : (
          keys.map((key) => (
            <ProjectKeyCard
              error={error}
              isPrimary={primaryKeyId === key.id}
              key={key.id}
              keyData={key}
              managed={managedKey?.id === key.id}
              onManage={(open) => {
                onResetError();
                onManagedKeyChange(open ? key : null);
              }}
              onRotate={() => void onRotateKey(key.id)}
              onSave={(event) => void onSaveKey(event)}
              onToggle={() => void onToggleKey(key, !key.isActive)}
              rotating={isRotating}
              updating={isUpdating}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProjectKeyCard({
  error,
  isPrimary,
  keyData,
  managed,
  onManage,
  onRotate,
  onSave,
  onToggle,
  rotating,
  updating,
}: {
  error: string | null;
  isPrimary: boolean;
  keyData: ProjectKeyDto;
  managed: boolean;
  onManage: (open: boolean) => void;
  onRotate: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onToggle: () => void;
  rotating: boolean;
  updating: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{keyData.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {keyData.isActive ? "Active stream" : "Stream disabled"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPrimary ? <Badge variant="accent">primary</Badge> : null}
          <Badge>{keyData.isActive ? "active" : "disabled"}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-muted-foreground">
        <CopyableCode label="Public key" value={keyData.publicKey} />
        {keyData.dsn ? <CopyableCode label="DSN" value={keyData.dsn} /> : null}
        {keyData.envelopeUrl ? (
          <CopyableCode label="Envelope URL" value={keyData.envelopeUrl} />
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Dialog onOpenChange={onManage} open={managed}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              Manage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage key</DialogTitle>
              <DialogDescription>
                Update this key&apos;s name, ingestion status, or rate limit.
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={onSave}>
              <Field label="Key name">
                <Input defaultValue={keyData.name} name="name" required />
              </Field>
              <Field label="Rate limit / minute">
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
              <FormDialogActions isPending={updating} submitLabel="Save changes" />
            </form>
          </DialogContent>
        </Dialog>
        <Button disabled={updating} onClick={onToggle} size="sm" variant="secondary">
          {keyData.isActive ? "Disable" : "Reactivate"}
        </Button>
        <Button disabled={rotating} onClick={onRotate} size="sm" variant="ghost">
          Rotate
        </Button>
      </div>
    </div>
  );
}

export { ProjectKeyListCard };
