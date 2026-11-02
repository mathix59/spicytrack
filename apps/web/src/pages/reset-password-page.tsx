import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "@/components/auth/password-policy";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }

    try {
      setIsPending(true);
      const result = await authClient.resetPassword({ token, newPassword });
      if (result.error) {
        throw new Error(result.error.message ?? "Unable to reset password");
      }
      setDone(true);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground sm:px-6">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <CardHeader className="p-0">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-6">
          {!token ? (
            <div className="grid gap-4">
              <Alert variant="destructive">
                <AlertDescription>
                  This link is invalid: the reset token is missing. Request a new reset link from
                  the sign-in page.
                </AlertDescription>
              </Alert>
              <Button asChild variant="secondary">
                <Link to="/">Back to sign in</Link>
              </Button>
            </div>
          ) : done ? (
            <div className="grid gap-4">
              <Alert role="status" variant="success">
                <AlertDescription>Password updated. You can now sign in.</AlertDescription>
              </Alert>
              <Button asChild>
                <Link to="/">Go to sign in</Link>
              </Button>
            </div>
          ) : (
            <form aria-busy={isPending} className="grid gap-4" onSubmit={submit}>
              <Field hint={PASSWORD_HINT} label="New password">
                <PasswordInput
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  name="newPassword"
                  required
                />
              </Field>
              <Field label="Confirm new password">
                <PasswordInput
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  name="confirmPassword"
                  required
                />
              </Field>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? <Loader2 className="animate-spin" /> : null}
                {isPending ? "Resetting…" : "Reset password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { ResetPasswordPage };
