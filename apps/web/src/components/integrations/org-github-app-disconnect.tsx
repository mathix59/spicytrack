import { useDeleteOrganizationGithubAppSettings } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";

function OrgGithubAppDisconnect({
  orgSlug,
  onDisconnected,
}: {
  orgSlug: string;
  onDisconnected: () => Promise<unknown>;
}) {
  const deleteMutation = useDeleteOrganizationGithubAppSettings({
    mutation: { onSuccess: onDisconnected },
  });

  return (
    <ConfirmDialog
      confirmLabel="Disconnect"
      description="SpicyTrack forgets the GitHub App credentials and its repositories. Projects linked through the App lose their repository, so Autofix stops for them; repositories connected with a personal token keep working. The App stays on GitHub until you delete it there."
      onConfirm={async () => {
        await deleteMutation.mutateAsync({ orgSlug });
      }}
      successMessage="GitHub disconnected"
      title="Disconnect GitHub?"
      trigger={
        <Button size="sm" variant="outline">
          Disconnect
        </Button>
      }
    />
  );
}

export { OrgGithubAppDisconnect };
