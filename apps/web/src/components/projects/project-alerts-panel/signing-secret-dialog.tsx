import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const VERIFY_SNIPPET = `const [t, v1] = header.split(",").map((part) => part.split("=")[1]);
const expected = crypto
  .createHmac("sha256", SECRET)
  .update(\`\${t}.\${rawBody}\`)
  .digest("hex");
// Reject if expected !== v1, or if t is more than 5 minutes old.`;

/** Shows a webhook signing secret once, right after it is created or rotated. */
function SigningSecretDialog({
  revealed,
  onClose,
}: {
  revealed: { ruleName: string; secret: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={revealed !== null}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Signing secret for “{revealed?.ruleName}”</DialogTitle>
          <DialogDescription>
            Copy it into your receiver now: it is stored encrypted and never shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-sm" title={revealed?.secret}>
            {revealed?.secret}
          </code>
          <CopyButton
            label="Copy secret"
            successMessage="Signing secret copied"
            value={revealed?.secret ?? ""}
          />
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <p>
            Each delivery carries{" "}
            <code className="font-mono text-foreground">X-SpicyTrack-Signature: t=…,v1=…</code>, the
            hex HMAC-SHA256 of <code className="font-mono text-foreground">t.rawBody</code>:
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
            {VERIFY_SNIPPET}
          </pre>
        </div>
        <Alert>
          <AlertDescription>
            Rotating the secret later invalidates this one immediately.
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={onClose} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { SigningSecretDialog };
