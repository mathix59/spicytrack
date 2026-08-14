import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="p-0">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-6">
          {!token ? (
            <Alert variant="destructive">
              <AlertDescription>This link is invalid: the reset token is missing.</AlertDescription>
            </Alert>
          ) : done ? (
            <div className="grid gap-4">
              <Alert className="border-emerald-500/30 text-emerald-500">
                <AlertDescription className="text-emerald-500">
                  Password updated. You can now sign in.
                </AlertDescription>
              </Alert>
              <Link to="/">
                <Button className="w-full" type="button">
                  Go to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={submit}>
              <Field label="New password">
                <Input minLength={8} name="newPassword" required type="password" />
              </Field>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button disabled={isPending} size="lg" type="submit">
                {isPending ? "Please wait..." : "Reset password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { ResetPasswordPage };
