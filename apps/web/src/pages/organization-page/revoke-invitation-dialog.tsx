import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  getListOrganizationInvitationsQueryKey,
  useRevokeOrganizationInvitation,
  type OrganizationInvitationDto,
} from "@/generated/api";
import { Button } from "@/components/ui/button";

export function RevokeInvitationDialog({
  orgSlug,
  invitation,
}: {
  orgSlug: string;
  invitation: OrganizationInvitationDto;
}) {
  const queryClient = useQueryClient();
  const mutation = useRevokeOrganizationInvitation();

  const revoke = async () => {
    try {
      await mutation.mutateAsync({ orgSlug, invitationId: invitation.id });
    } catch {
      throw new Error("Could not revoke this invitation. Check your permissions and try again.");
    }
    await queryClient.invalidateQueries({
      queryKey: getListOrganizationInvitationsQueryKey(orgSlug),
    });
  };

  return (
    <ConfirmDialog
      confirmLabel="Confirm revocation"
      description={`The invitation for ${invitation.email} will be removed. Its email link will no longer work.`}
      onConfirm={revoke}
      successMessage="Invitation revoked"
      title="Revoke invitation"
      trigger={
        <Button size="sm" variant="ghost">
          Revoke invitation
        </Button>
      }
    />
  );
}
