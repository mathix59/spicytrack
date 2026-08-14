import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useAcceptOrganizationInvitation, useGetMe } from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { LoadingScreen } from "@/components/common/loading-screen";

function InvitationAcceptPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const meQuery = useGetMe({ query: { retry: false } });
  const acceptInvitationMutation = useAcceptOrganizationInvitation();
  const errorStatus = (meQuery.error as { status?: number } | null)?.status;

  useEffect(() => {
    if (hasRun.current || !token || !meQuery.data?.data) {
      return;
    }

    hasRun.current = true;
    acceptInvitationMutation
      .mutateAsync({ data: { token } })
      .then(() => navigate("/app", { replace: true }))
      .catch((caughtError: unknown) => setError(getErrorMessage(caughtError)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meQuery.data, navigate, token]);

  if (meQuery.isLoading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (errorStatus === 401) {
    return (
      <Navigate replace state={{ returnTo: `${location.pathname}${location.search}` }} to="/" />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-md p-8">
        <CardHeader className="p-0">
          <h1 className="text-2xl font-semibold tracking-tight">Organization invitation</h1>
          <CardDescription>
            {error ? "This invitation could not be accepted." : "Accepting your invitation..."}
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
              onClick={() => navigate("/app")}
              type="button"
              variant="secondary"
            >
              Back to the app
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

export { InvitationAcceptPage };
