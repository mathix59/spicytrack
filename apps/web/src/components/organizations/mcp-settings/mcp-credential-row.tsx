import { CheckCircle2, RotateCw, ShieldCheck, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocalDateTime } from "@/lib/utils";

import type { McpCredential, McpVerification } from "./mcp-api";

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function McpCredentialRow({
  credential,
  verification,
  isVerifying,
  onVerify,
  onRotate,
  onRevoke,
}: {
  credential: McpCredential;
  verification: McpVerification | null;
  isVerifying: boolean;
  onVerify: () => void;
  onRotate: () => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{credential.name}</span>
          {credential.revokedAt ? (
            <Badge variant="muted">Revoked</Badge>
          ) : (
            <Badge variant="success">Active</Badge>
          )}
          <code className="text-xs text-muted-foreground">{credential.tokenPreview}…</code>
        </div>
        <p className="text-xs text-muted-foreground">
          {credential.allProjects
            ? "All projects"
            : plural(credential.projectIds.length, "selected project")}{" "}
          · {credential.scopes.join(", ")} ·{" "}
          {credential.lastUsedAt
            ? `Used ${formatLocalDateTime(credential.lastUsedAt)}`
            : "Never used"}
          {credential.expiresAt ? ` · Expires ${formatLocalDateTime(credential.expiresAt)}` : ""}
        </p>
        {verification ? (
          <Alert variant={verification.ready ? "success" : "destructive"}>
            <AlertDescription className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              {verification.ready
                ? `Ready: server enabled, active key, ${plural(verification.checks.projectsAccessible, "accessible project")}.`
                : "This key is not ready. Enable MCP or replace the expired/revoked key."}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
      {!credential.revokedAt ? (
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button disabled={isVerifying} onClick={onVerify} size="sm" type="button" variant="ghost">
            <ShieldCheck className="size-4" />
            Check
          </Button>
          <ConfirmDialog
            confirmLabel="Rotate key"
            description={`The current secret for "${credential.name}" stops working immediately. Clients using it must be updated with the new key.`}
            onConfirm={onRotate}
            successMessage="Key rotated. Copy the new secret now."
            title="Rotate MCP key?"
            trigger={
              <Button size="sm" type="button" variant="ghost">
                <RotateCw className="size-4" />
                Rotate
              </Button>
            }
          />
          <ConfirmDialog
            confirmLabel="Revoke key"
            description={`Clients using "${credential.name}" lose access immediately. This cannot be undone.`}
            onConfirm={onRevoke}
            successMessage="Key revoked"
            title="Revoke MCP key?"
            trigger={
              <Button size="sm" type="button" variant="ghost">
                <Trash2 className="size-4 text-destructive" />
                Revoke
              </Button>
            }
          />
        </div>
      ) : null}
    </div>
  );
}

export { McpCredentialRow };
