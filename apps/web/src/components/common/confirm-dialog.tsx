import { type ReactNode, useState } from "react";
import { toast } from "sonner";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";

/**
 * Confirmation dialog for destructive or disruptive actions. It owns its pending and error
 * state, so callers only pass the action; the dialog closes itself once the action succeeds.
 */
function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  successMessage,
  destructive = true,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown> | unknown;
  successMessage?: string;
  destructive?: boolean;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!next) setError(null);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      if (successMessage) toast.success(successMessage);
      setOpen(false);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
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
          <Button
            disabled={pending}
            onClick={() => void confirm()}
            type="button"
            variant={destructive ? "destructive" : "default"}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConfirmDialog };
