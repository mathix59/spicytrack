import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { orvalFetch } from "@/lib/orval-fetch";
import { getErrorMessage } from "@/lib/utils";
import type { InstanceUser } from "../instance-admin-page";

export function DeleteUserDialog({
  user,
  onDeleted,
}: {
  user: InstanceUser;
  onDeleted: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setPending(true);
    setError(null);
    try {
      await orvalFetch(`/instance-admin/users/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationEmail: email }),
      });
      setOpen(false);
      await onDeleted();
    } catch (caught) {
      const message = getErrorMessage(caught);
      try {
        const payload: unknown = JSON.parse(message);
        setError(
          payload &&
            typeof payload === "object" &&
            "message" in payload &&
            typeof payload.message === "string"
            ? payload.message
            : message,
        );
      } catch {
        setError(message);
      }
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
        <Button variant="ghost" size="sm">
          Delete user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user permanently</DialogTitle>
          <DialogDescription>
            This removes {user.email}, their Better Auth account, sessions, two-factor
            authentication, personal tokens, invitations and organization access. This cannot be
            undone. Transfer sole organization ownership first.
          </DialogDescription>
        </DialogHeader>
        <Field label={`Type ${user.email} to confirm`}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            autoComplete="off"
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            disabled={pending || email !== user.email}
            onClick={() => void remove()}
          >
            Delete permanently
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
