import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { getGetMeQueryKey } from "@/generated/api";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type VerificationMethod = "totp" | "backup";

function TwoFactorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState<VerificationMethod>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const trimmedCode = code.trim();
  const canSubmit = method === "totp" ? trimmedCode.length === 6 : trimmedCode.length > 0;

  const switchMethod = () => {
    setMethod((value) => (value === "totp" ? "backup" : "totp"));
    setCode("");
    setError(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const result =
        method === "totp"
          ? await authClient.twoFactor.verifyTotp({ code: trimmedCode, trustDevice: false })
          : await authClient.twoFactor.verifyBackupCode({ code: trimmedCode, trustDevice: false });

      if (result.error) {
        throw new Error(
          result.error.message ??
            (method === "totp" ? "Invalid authenticator code" : "Invalid backup code"),
        );
      }

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      navigate("/app", { replace: true });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground sm:px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary-accent">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Two-factor verification</h1>
          <CardDescription>
            {method === "totp"
              ? "Enter the 6-digit code from your authenticator app."
              : "Enter one of the backup codes you saved when you set up two-factor authentication. Each code works once."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="grid gap-4" onSubmit={submit}>
            {method === "totp" ? (
              <Field key="totp" label="Authenticator code">
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  className="font-mono tracking-[0.3em]"
                  inputMode="numeric"
                  maxLength={6}
                  name="code"
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  pattern="[0-9]{6}"
                  placeholder="123456"
                  value={code}
                />
              </Field>
            ) : (
              <Field key="backup" label="Backup code">
                <Input
                  autoCapitalize="off"
                  autoComplete="one-time-code"
                  autoFocus
                  className="font-mono"
                  name="backupCode"
                  onChange={(event) => setCode(event.target.value)}
                  spellCheck={false}
                  value={code}
                />
              </Field>
            )}

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button disabled={isPending || !canSubmit} type="submit">
              {isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              {isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>
          <Button disabled={isPending} onClick={switchMethod} type="button" variant="ghost">
            {method === "totp" ? "Use a backup code instead" : "Use your authenticator app"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export { TwoFactorPage };
