import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";

import type { InstanceUser } from "./types";

/** Typed-confirmation dialog: the user's email must be entered before deletion is allowed. */
export function DeleteUserDialog({
  user,
  onDelete,
}: {
  user: InstanceUser;
  onDelete: (userId: string, confirmationEmail: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setPending(true);
    setError(null);
    try {
      await onDelete(user.id, email);
      setOpen(false);
      toast.success("User deleted");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          setEmail("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="text-destructive hover:text-destructive" size="sm" variant="ghost">
          <Trash2 />
          Delete user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user permanently</DialogTitle>
          <DialogDescription>
            This removes {user.email} together with their sessions, two-factor authentication,
            personal access tokens, invitations and organization access. This cannot be undone. If
            they are the only owner of an organization, transfer ownership first.
          </DialogDescription>
        </DialogHeader>
        <Field label={`Type ${user.email} to confirm`}>
          <Input
            autoComplete="off"
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
            value={email}
          />
        </Field>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button disabled={pending} onClick={() => setOpen(false)} type="button" variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={pending || email !== user.email}
            onClick={() => void remove()}
            type="button"
            variant="destructive"
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
