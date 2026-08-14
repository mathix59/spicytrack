import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeySquare, ShieldCheck, ShieldOff } from "lucide-react";

import { getGetMeQueryKey, type UserDto } from "@/generated/api";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function readTotpSecret(uri: string) {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

function AccountTwoFactorCard({ user }: { user: UserDto | undefined }) {
  const queryClient = useQueryClient();
  const [setupPassword, setSetupPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);

  const setupSecret = useMemo(() => (totpUri ? readTotpSecret(totpUri) : ""), [totpUri]);

  const invalidateProfile = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const startSetup = async () => {
    setError(null);
    setSuccess(null);
    setIsPending(true);

    try {
      const result = await authClient.twoFactor.enable({
        password: setupPassword,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Unable to enable two-factor authentication");
      }

      setTotpUri(result.data?.totpURI ?? null);
      setBackupCodes(result.data?.backupCodes ?? []);
      setVerificationCode("");
      setSuccess("Scan the setup key in your authenticator app, then verify the current code.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  const verifySetup = async () => {
    setError(null);
    setSuccess(null);
    setIsPending(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode,
        trustDevice: false,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Invalid authenticator code");
      }

      await invalidateProfile();
      setSetupPassword("");
      setVerificationCode("");
      setTotpUri(null);
      setBackupCodes([]);
      setSuccess("Two-factor authentication enabled.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  const disableTwoFactor = async () => {
    setError(null);
    setSuccess(null);
    setIsPending(true);

    try {
      const result = await authClient.twoFactor.disable({
        password: disablePassword,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Unable to disable two-factor authentication");
      }

      await invalidateProfile();
      setDisablePassword("");
      setSuccess("Two-factor authentication disabled.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Use a TOTP app such as Google Authenticator, Authy, 1Password, or Aegis.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        {user?.twoFactorEnabled ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-4">
              <ShieldCheck className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">2FA is enabled</p>
                <p className="text-xs text-muted-foreground">
                  Your account now requires a TOTP code after password sign-in.
                </p>
              </div>
            </div>

            <Field label="Current password">
              <Input
                autoComplete="current-password"
                onChange={(event) => setDisablePassword(event.target.value)}
                type="password"
                value={disablePassword}
              />
            </Field>

            <div>
              <Button
                disabled={isPending || !disablePassword}
                onClick={() => void disableTwoFactor()}
              >
                <ShieldOff className="size-4" />
                {isPending ? "Updating…" : "Disable 2FA"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <Field label="Current password">
              <Input
                autoComplete="current-password"
                onChange={(event) => setSetupPassword(event.target.value)}
                type="password"
                value={setupPassword}
              />
            </Field>

            {!totpUri ? (
              <div>
                <Button disabled={isPending || !setupPassword} onClick={() => void startSetup()}>
                  <KeySquare className="size-4" />
                  {isPending ? "Preparing…" : "Set up authenticator"}
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-medium">Setup key</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {setupSecret}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">otpauth URI</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {totpUri}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Backup codes</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {backupCodes.map((code) => (
                      <code className="rounded bg-background px-2 py-1 text-xs" key={code}>
                        {code}
                      </code>
                    ))}
                  </div>
                </div>

                <Field label="Authenticator code">
                  <Input
                    inputMode="numeric"
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="123456"
                    value={verificationCode}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={isPending || verificationCode.length < 6}
                    onClick={() => void verifySetup()}
                  >
                    <ShieldCheck className="size-4" />
                    {isPending ? "Verifying…" : "Verify and enable"}
                  </Button>
                  <Button
                    disabled={isPending}
                    onClick={() => {
                      setTotpUri(null);
                      setBackupCodes([]);
                      setVerificationCode("");
                      setSuccess(null);
                      setError(null);
                    }}
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { AccountTwoFactorCard };
