import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQueryClient } from "@tanstack/react-query";
import { AuthForm } from "@/components/auth/auth-form";
import { getGetMeQueryKey, useAcceptOrganizationInvitation, useGetMe } from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { LoadingScreen } from "@/components/common/loading-screen";

function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const attemptedToken = useRef<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const meQuery = useGetMe({ query: { retry: false } });
  const acceptInvitationMutation = useAcceptOrganizationInvitation();
  const errorStatus = (meQuery.error as { status?: number } | null)?.status;

  useEffect(() => {
    if (attemptedToken.current === token || !token || meQuery.isFetching || !meQuery.data?.data) {
      return;
    }

    attemptedToken.current = token;
    acceptInvitationMutation
      .mutateAsync({ data: { token } })
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        sessionStorage.removeItem("spicytrack.authReturnTo");
        navigate("/app", { replace: true });
      })
      .catch((caughtError: unknown) => setError(getErrorMessage(caughtError)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meQuery.data, meQuery.isFetching, navigate, token, retry]);

  if (meQuery.isLoading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (token && errorStatus === 401) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
        <div className="grid gap-4">
          <h1 className="text-2xl font-semibold">Join your organization</h1>
          <p>
            Create an account using the invited email address, or sign in to your existing account.
          </p>
          <AuthForm
            invitationToken={token}
            onAuthenticated={async () => {
              attemptedToken.current = null;
              setError(null);
              const session = await meQuery.refetch();
              if (!session.data?.data)
                throw new Error(
                  "Unable to confirm your session. Please sign in to finish accepting the invitation.",
                );
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="p-0">
          <h1 className="text-2xl font-semibold tracking-tight">Organization invitation</h1>
          <CardDescription>
            {!token || error
              ? "This invitation could not be accepted."
              : "Accepting your invitation..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-6">
          {!token || error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error ?? "This invitation link is invalid: the token is missing."}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Button
              className="mt-4 w-full"
              onClick={() => {
                attemptedToken.current = null;
                setError(null);
                setRetry((value) => value + 1);
              }}
              type="button"
              variant="secondary"
            >
              Retry invitation
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export { InvitationAcceptPage };
