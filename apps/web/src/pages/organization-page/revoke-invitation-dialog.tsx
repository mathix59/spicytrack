import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListOrganizationInvitationsQueryKey,
  useRevokeOrganizationInvitation,
  type OrganizationInvitationDto,
} from "@/generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RevokeInvitationDialog({
  orgSlug,
  invitation,
}: {
  orgSlug: string;
  invitation: OrganizationInvitationDto;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();
  const mutation = useRevokeOrganizationInvitation();
  const revoke = async () => {
    setError(false);
    try {
      await mutation.mutateAsync({ orgSlug, invitationId: invitation.id });
      await queryClient.invalidateQueries({
        queryKey: getListOrganizationInvitationsQueryKey(orgSlug),
      });
      setOpen(false);
    } catch {
      setError(true);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(false);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Revoke invitation
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke invitation</DialogTitle>
          <DialogDescription>
            The invitation for {invitation.email} will be removed. Its email link will no longer
            work.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            Could not revoke this invitation. Check your permissions and try again.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void revoke()} disabled={mutation.isPending}>
            Confirm revocation
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
