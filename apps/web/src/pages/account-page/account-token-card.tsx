import { useState } from "react";
import { KeyRound } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import type { PersonalAccessTokenDto } from "@/generated/api";
import { readApiErrorMessage } from "@/lib/api-error";
import { formatLocalDate } from "@/lib/utils";

import { AccountSection } from "./account-section";
import { CreatedTokenNotice } from "./created-token-notice";
import { useAccountTokens } from "./use-account-tokens";

function formatOptionalDate(value: string | null | undefined, fallback: string) {
  return value ? formatLocalDate(value) : fallback;
}

function TokenRow({
  token,
  now,
  onRevoke,
}: {
  token: PersonalAccessTokenDto;
  now: number;
  onRevoke: (tokenId: string) => Promise<unknown>;
}) {
  const expired = token.expiresAt ? new Date(token.expiresAt).getTime() < now : false;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium [overflow-wrap:anywhere]">{token.name}</p>
          {expired ? <Badge variant="danger">Expired</Badge> : null}
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{token.tokenPreview}…</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Created {formatOptionalDate(token.createdAt, "—")} · Last used{" "}
          {formatOptionalDate(token.lastUsedAt, "never")} · {expired ? "Expired" : "Expires"}{" "}
          {formatOptionalDate(token.expiresAt, "never")}
        </p>
      </div>
      <ConfirmDialog
        confirmLabel="Revoke token"
        description={`Anything using “${token.name}” will immediately lose API access. This cannot be undone.`}
        onConfirm={() => onRevoke(token.id)}
        successMessage="Token revoked"
        title="Revoke this token?"
        trigger={
          <Button className="self-start sm:self-auto" size="sm" type="button" variant="ghost">
            Revoke
          </Button>
        }
      />
    </li>
  );
}

function AccountTokenCard() {
  const state = useAccountTokens();
  const { tokensQuery, tokens } = state;
  const [now] = useState(() => Date.now());

  return (
    <AccountSection
      action={tokensQuery.data ? <Badge variant="muted">{tokens.length}</Badge> : null}
      description="Authenticate scripts, CI pipelines and the CLI against the SpicyTrack API. Tokens act with your permissions."
      icon={KeyRound}
      title="Personal access tokens"
    >
      <form
        aria-busy={state.isCreating}
        className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end"
        onSubmit={(event) => void state.createToken(event)}
      >
        <Field label="Name">
          <Input autoComplete="off" name="name" placeholder="CI pipeline" required />
        </Field>
        <Field label="Expires in (days)">
          <Input
            inputMode="numeric"
            min="1"
            name="expiresInDays"
            placeholder="Never"
            type="number"
          />
        </Field>
        <Button disabled={state.isCreating} type="submit">
          <KeyRound />
          {state.isCreating ? "Creating…" : "Create"}
        </Button>
      </form>

      {state.createError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.createError}</AlertDescription>
        </Alert>
      ) : null}

      {state.createdToken ? (
        <CreatedTokenNotice onDismiss={state.dismissCreatedToken} token={state.createdToken} />
      ) : null}

      {tokensQuery.isPending ? (
        <SkeletonRows rows={2} />
      ) : tokensQuery.isError ? (
        <QueryError
          error={new Error(readApiErrorMessage(tokensQuery.error))}
          onRetry={() => void tokensQuery.refetch()}
          title="Could not load your tokens"
        />
      ) : tokens.length === 0 ? (
        <EmptyState
          description="Create a token to call the API outside the browser."
          icon={KeyRound}
          title="No tokens yet"
        />
      ) : (
        <ul className="grid gap-2">
          {tokens.map((token) => (
            <TokenRow key={token.id} now={now} onRevoke={state.revokeToken} token={token} />
          ))}
        </ul>
      )}
    </AccountSection>
  );
}

export { AccountTokenCard };
