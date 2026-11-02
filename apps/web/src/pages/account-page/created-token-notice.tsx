import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

import type { CreatedToken } from "./use-account-tokens";

/** One-time display of a freshly created token secret. */
function CreatedTokenNotice({ token, onDismiss }: { token: CreatedToken; onDismiss: () => void }) {
  return (
    <section
      aria-labelledby="created-token-title"
      className="grid gap-3 rounded-lg border border-success/40 bg-success/5 p-4"
    >
      <div className="grid gap-1">
        <h3 className="text-sm font-medium" id="created-token-title">
          Token “{token.name}” created
        </h3>
        <p className="flex items-start gap-2 text-xs text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          Copy it now and store it somewhere safe. You won't be able to see it again.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2 pl-3">
        <code className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">
          {token.secret}
        </code>
        <CopyButton label="Copy token" successMessage="Token copied" value={token.secret} />
      </div>
      <div>
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">
          I've saved it
        </Button>
      </div>
    </section>
  );
}

export { CreatedTokenNotice };
