import { KeyRound } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { renderNullableText } from "@/lib/utils";

import type { AccountPageData } from "./types";

function AccountTokenCard({
  tokens,
  tokenError,
  createdSecret,
  isCreatingToken,
  isRevokingToken,
  createToken,
  revokeToken,
}: Pick<
  AccountPageData,
  | "tokens"
  | "tokenError"
  | "createdSecret"
  | "isCreatingToken"
  | "isRevokingToken"
  | "createToken"
  | "revokeToken"
>) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Personal access tokens</CardTitle>
          <Badge variant="muted">{tokens.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 p-4"
          onSubmit={createToken}
        >
          <Field className="flex-1" label="Name">
            <Input name="name" placeholder="CI pipeline" required />
          </Field>
          <Field label="Expires in (days)">
            <Input min="1" name="expiresInDays" placeholder="never" type="number" />
          </Field>
          <Button disabled={isCreatingToken} size="sm" type="submit">
            <KeyRound className="size-4" />
            Create
          </Button>
        </form>
        {tokenError ? (
          <Alert variant="destructive">
            <AlertDescription>{tokenError}</AlertDescription>
          </Alert>
        ) : null}

        {createdSecret ? (
          <Alert className="border-emerald-500/30">
            <AlertDescription>
              <p className="font-medium text-foreground">Token created</p>
              <p className="mt-1 text-xs text-emerald-500">
                Copy it now - it won&apos;t be shown again.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                {createdSecret}
              </pre>
            </AlertDescription>
          </Alert>
        ) : null}

        {tokens.length === 0 ? (
          <EmptyState
            title="No tokens yet"
            description="Create a token to call the API outside the browser."
          />
        ) : (
          <div className="grid gap-3">
            {tokens.map((token) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4"
                key={token.id}
              >
                <div>
                  <p className="font-medium">{token.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {token.tokenPreview}…
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last used: {renderNullableText(token.lastUsedAt, "never")} · Expires:{" "}
                    {renderNullableText(token.expiresAt, "never")}
                  </p>
                </div>
                <Button
                  disabled={isRevokingToken}
                  onClick={() => void revokeToken(token.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { AccountTokenCard };
