import type { FormEvent, ReactNode } from "react";

import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

import { AlertRuleConfigFields } from "./alert-rule-config-fields";
import type { DestinationType } from "./types";

function AlertRuleCreateDialog({
  open,
  error,
  isPending,
  destinationType,
  trigger,
  onOpenChange,
  onDestinationTypeChange,
  onSubmit,
}: {
  open: boolean;
  error: string | null;
  isPending: boolean;
  destinationType: DestinationType;
  trigger: ReactNode;
  onOpenChange: (open: boolean) => void;
  onDestinationTypeChange: (value: DestinationType) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New alert rule</DialogTitle>
          <DialogDescription>
            React to new issues or event thresholds by notifying a destination.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
          <Field label="Name">
            <Input name="name" placeholder="Production errors" required />
          </Field>
          <AlertRuleConfigFields
            cooldownMinutes={30}
            destinationType={destinationType}
            onDestinationTypeChange={onDestinationTypeChange}
            triggerTypes={["new_issue"]}
          />
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FormDialogActions isPending={isPending} submitLabel="Create rule" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { AlertRuleCreateDialog };
