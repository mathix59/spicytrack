import { RefreshCw, Settings2 } from "lucide-react";
import { toast } from "sonner";

import type { ProjectKeyDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyableCode } from "@/components/projects/sdk-snippets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

function ProjectKeyItem({
  keyData,
  isPrimary,
  isUpdating,
  onManage,
  onSetActive,
  onRotate,
}: {
  keyData: ProjectKeyDto;
  isPrimary: boolean;
  isUpdating: boolean;
  onManage: () => void;
  onSetActive: (isActive: boolean) => Promise<void>;
  onRotate: () => Promise<void>;
}) {
  const reactivate = async () => {
    try {
      await onSetActive(true);
      toast.success(`${keyData.name} reactivated`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <li className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{keyData.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {keyData.isActive ? "Accepting events" : "Ingestion disabled"}
            {keyData.rateLimitPerMinute ? ` · ${keyData.rateLimitPerMinute} events/min` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPrimary ? <Badge variant="accent">primary</Badge> : null}
          <Badge variant={keyData.isActive ? "success" : "muted"}>
            {keyData.isActive ? "active" : "disabled"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3">
        {keyData.dsn ? <CopyableCode label="DSN" value={keyData.dsn} /> : null}
        <CopyableCode label="Public key" value={keyData.publicKey} />
        {keyData.envelopeUrl ? (
          <CopyableCode label="Envelope URL" value={keyData.envelopeUrl} />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onManage} size="sm" type="button" variant="outline">
          <Settings2 />
          Manage
        </Button>
        {keyData.isActive ? (
          <ConfirmDialog
            confirmLabel="Disable key"
            description="SDKs using this DSN will have their events rejected until the key is reactivated. The key itself is kept."
            onConfirm={() => onSetActive(false)}
            successMessage={`${keyData.name} disabled`}
            title={`Disable ${keyData.name}?`}
            trigger={
              <Button size="sm" type="button" variant="secondary">
                Disable
              </Button>
            }
          />
        ) : (
          <Button
            disabled={isUpdating}
            onClick={() => void reactivate()}
            size="sm"
            type="button"
            variant="secondary"
          >
            Reactivate
          </Button>
        )}
        <ConfirmDialog
          confirmLabel="Rotate key"
          description="A new public key and DSN are generated. SDKs still configured with the current DSN will be rejected until you deploy the new one."
          onConfirm={onRotate}
          successMessage={`${keyData.name} rotated`}
          title={`Rotate ${keyData.name}?`}
          trigger={
            <Button size="sm" type="button" variant="ghost">
              <RefreshCw />
              Rotate
            </Button>
          }
        />
      </div>
    </li>
  );
}

export { ProjectKeyItem };
