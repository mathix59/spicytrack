import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

import {
  GITHUB_APP_INSTALL_ORG_KEY,
  GITHUB_APP_INSTALL_STATE_KEY,
} from "@/components/integrations/org-github-app-card";
import {
  completeOrganizationGithubAppInstallation,
  completeOrganizationGithubAppManifest,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LAST_ORG_KEY = "spicytrack.lastOrg";

function GithubAppSetupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Finalizing GitHub App setup…");

  const installationId = searchParams.get("installation_id") ?? "";
  const manifestCode = searchParams.get("code") ?? "";
  const returnedState = searchParams.get("state") ?? "";
  const setupAction = searchParams.get("setup_action") ?? "";
  const orgSlug =
    sessionStorage.getItem(GITHUB_APP_INSTALL_ORG_KEY) ?? localStorage.getItem(LAST_ORG_KEY) ?? "";
  const expectedState = sessionStorage.getItem(GITHUB_APP_INSTALL_STATE_KEY) ?? "";

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const complete = async () => {
      if (!installationId && !manifestCode) {
        throw new Error(
          setupAction
            ? `Missing GitHub callback parameters after setup_action=${setupAction}.`
            : "Missing GitHub callback parameters.",
        );
      }
      if (!returnedState || !expectedState || returnedState !== expectedState) {
        throw new Error("GitHub App setup state mismatch. Restart the connection flow.");
      }
      if (!orgSlug) {
        throw new Error("No organization context found. Restart from organization settings.");
      }

      if (manifestCode) {
        setMessage("GitHub App created. Opening repository access selection…");
        const result = await completeOrganizationGithubAppManifest(orgSlug, {
          code: manifestCode,
          state: returnedState,
        });
        window.location.assign(result.data.installUrl);
        return;
      }

      await completeOrganizationGithubAppInstallation(orgSlug, {
        installationId,
        state: returnedState,
      });
      sessionStorage.removeItem(GITHUB_APP_INSTALL_ORG_KEY);
      sessionStorage.removeItem(GITHUB_APP_INSTALL_STATE_KEY);
      setStatus("success");
      setMessage("GitHub App connected. Its repositories are ready in SpicyTrack.");
    };

    void complete().catch((error: unknown) => {
      setStatus("error");
      setMessage(getErrorMessage(error));
    });
  }, [expectedState, installationId, manifestCode, orgSlug, returnedState, setupAction]);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>GitHub connection</CardTitle>
          <CardDescription>
            SpicyTrack securely creates, installs, and synchronizes your private GitHub App.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {status === "pending" ? (
            <Alert>
              <LoaderCircle className="size-4 animate-spin" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {status === "success" ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          {status === "error" ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {orgSlug ? (
              <Button onClick={() => navigate(`/orgs/${orgSlug}`, { replace: true })} type="button">
                Back to organization
              </Button>
            ) : null}
            <Button asChild type="button" variant="ghost">
              <Link to="/app">Go to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { GithubAppSetupPage };
