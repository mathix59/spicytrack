import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, GitBranch } from "lucide-react";

import {
  getGetOrganizationGithubAppSettingsQueryKey,
  useCreateOrganizationGithubAppManifest,
  useGetOrganizationGithubAppSettings,
  useUpdateOrganizationGithubAppSettings,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const GITHUB_APP_INSTALL_ORG_KEY = "spicytrack.githubAppInstallOrg";
const GITHUB_APP_INSTALL_STATE_KEY = "spicytrack.githubAppInstallState";

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function submitGithubManifest(action: string, state: string, manifest: string) {
  const form = document.createElement("form");
  form.action = `${action}?state=${encodeURIComponent(state)}`;
  form.method = "POST";

  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "manifest";
  input.value = manifest;
  form.append(input);
  document.body.append(form);
  form.submit();
}

function OrgGithubAppCard({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"cloud" | "enterprise">("cloud");
  const [githubOrganization, setGithubOrganization] = useState("");

  const settingsQuery = useGetOrganizationGithubAppSettings(orgSlug, {
    query: { enabled: canManage, retry: false },
  });
  const settings = settingsQuery.data?.data;
  const connected = Boolean(settings?.appId && settings.privateKeySet && settings.installationId);

  useEffect(() => {
    if (settings?.mode === "enterprise") setMode("enterprise");
  }, [settings?.mode]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: getGetOrganizationGithubAppSettingsQueryKey(orgSlug),
    });
  };
  const manifestMutation = useCreateOrganizationGithubAppManifest();
  const updateMutation = useUpdateOrganizationGithubAppSettings({
    mutation: { onSuccess: invalidate },
  });

  const startCloudSetup = async () => {
    setError(null);
    try {
      const response = await manifestMutation.mutateAsync({
        orgSlug,
        data: { githubOrganization: githubOrganization.trim() || undefined },
      });
      const { action, state, manifest } = response.data;
      sessionStorage.setItem(GITHUB_APP_INSTALL_ORG_KEY, orgSlug);
      sessionStorage.setItem(GITHUB_APP_INSTALL_STATE_KEY, state);
      submitGithubManifest(action, state, manifest);
    } catch (setupError) {
      setError(getErrorMessage(setupError));
    }
  };

  const saveEnterprise = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    const optionalSecret = (name: string) => String(data.get(name) ?? "").trim();
    try {
      await updateMutation.mutateAsync({
        orgSlug,
        data: {
          mode: "enterprise",
          htmlUrl: (optionalSecret("htmlUrl") || null) as never,
          apiUrl: (optionalSecret("apiUrl") || null) as never,
          gitUser: (optionalSecret("gitUser") || "git") as never,
          gitPort: Number(optionalSecret("gitPort") || "22"),
          appSlug: (optionalSecret("appSlug") || null) as never,
          appId: (optionalSecret("appId") || null) as never,
          clientId: (optionalSecret("clientId") || null) as never,
          ...(optionalSecret("clientSecret")
            ? { clientSecret: optionalSecret("clientSecret") as never }
            : {}),
          ...(optionalSecret("privateKey")
            ? { privateKey: optionalSecret("privateKey") as never }
            : {}),
          ...(optionalSecret("webhookSecret")
            ? { webhookSecret: optionalSecret("webhookSecret") as never }
            : {}),
        },
      });
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only organization owners and admins can manage this connection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-5" /> GitHub
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          SpicyTrack creates and configures your private GitHub App automatically. GitHub lets you
          grant access to every repository or only the repositories you select.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {connected ? (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertDescription>
              Connected to {asOptionalString(settings?.installationAccountLogin) || "GitHub"} via{" "}
              {settings?.appSlug}.
            </AlertDescription>
          </Alert>
        ) : null}

        <Field label="Hosting">
          <Select
            onChange={(event) =>
              setMode(event.target.value === "enterprise" ? "enterprise" : "cloud")
            }
            value={mode}
          >
            <option value="cloud">GitHub.com — automatic setup</option>
            <option value="enterprise">GitHub Enterprise Server — advanced</option>
          </Select>
        </Field>

        {mode === "cloud" ? (
          <div className="grid gap-4 rounded-lg border p-4">
            <div className="grid gap-1">
              <p className="font-medium">
                {connected ? "Reconfigure the GitHub App" : "Connect GitHub"}
              </p>
              <p className="text-sm text-muted-foreground">
                You will name the App on GitHub, choose all repositories or selected repositories,
                then return here automatically.
              </p>
            </div>
            <Field
              hint="Optional. Leave empty to create it on your personal GitHub account."
              label="GitHub organization"
            >
              <Input
                onChange={(event) => setGithubOrganization(event.target.value)}
                placeholder="acme"
                value={githubOrganization}
              />
            </Field>
            <div>
              <Button disabled={manifestMutation.isPending} onClick={startCloudSetup} type="button">
                {manifestMutation.isPending
                  ? "Preparing…"
                  : connected
                    ? "Reconfigure on GitHub"
                    : "Continue to GitHub"}
                <ExternalLink className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={saveEnterprise}>
            <Alert>
              <AlertDescription>
                GitHub Enterprise Server does not always support the Manifest flow. These advanced
                fields remain available for administrators.
              </AlertDescription>
            </Alert>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="HTML URL">
                <Input
                  defaultValue={asOptionalString(settings?.htmlUrl)}
                  name="htmlUrl"
                  placeholder="https://github.example.com"
                  required
                />
              </Field>
              <Field label="API URL">
                <Input
                  defaultValue={asOptionalString(settings?.apiUrl)}
                  name="apiUrl"
                  placeholder="https://github.example.com/api/v3"
                  required
                />
              </Field>
              <Field label="Git user">
                <Input defaultValue={asOptionalString(settings?.gitUser) || "git"} name="gitUser" />
              </Field>
              <Field label="Git port">
                <Input
                  defaultValue={String(settings?.gitPort ?? 22)}
                  min="1"
                  name="gitPort"
                  type="number"
                />
              </Field>
              <Field label="App slug">
                <Input defaultValue={asOptionalString(settings?.appSlug)} name="appSlug" required />
              </Field>
              <Field label="App ID">
                <Input defaultValue={asOptionalString(settings?.appId)} name="appId" required />
              </Field>
              <Field label="Client ID">
                <Input defaultValue={asOptionalString(settings?.clientId)} name="clientId" />
              </Field>
              <Field label="Client secret">
                <Input autoComplete="off" name="clientSecret" type="password" />
              </Field>
            </div>
            <Field label="Private key">
              <textarea
                className="min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                name="privateKey"
              />
            </Field>
            <Field label="Webhook secret">
              <Input autoComplete="off" name="webhookSecret" type="password" />
            </Field>
            <div>
              <Button disabled={updateMutation.isPending} type="submit">
                {updateMutation.isPending ? "Saving…" : "Save advanced configuration"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export { GITHUB_APP_INSTALL_ORG_KEY, GITHUB_APP_INSTALL_STATE_KEY, OrgGithubAppCard };
