import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || !token) {
      return;
    }
    hasRun.current = true;

    void authClient
      .verifyEmail({ query: { token } })
      .then((result) => {
        if (result.error) {
          throw new Error(result.error.message ?? "Unable to verify email");
        }
        setStatus("success");
      })
      .catch((caughtError: unknown) => {
        setError(getErrorMessage(caughtError));
        setStatus("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="p-0">
          <h1 className="text-2xl font-semibold tracking-tight">Email verification</h1>
          <CardDescription>
            {status === "pending"
              ? "Verifying your email..."
              : status === "success"
                ? "Your email has been verified."
                : "Verification failed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-6">
          {!token ? (
            <Alert variant="destructive">
              <AlertDescription>
                This link is invalid: the verification token is missing.
              </AlertDescription>
            </Alert>
          ) : status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Link className="mt-4 block" to="/">
            <Button className="w-full" type="button" variant="secondary">
              Back to the app
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export { VerifyEmailPage };
