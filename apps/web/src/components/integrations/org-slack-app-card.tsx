import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import {
  getGetOrganizationSlackSettingsQueryKey,
  useDeleteOrganizationSlackSettings,
  useGetOrganizationSlackSettings,
  useUpdateOrganizationSlackSettings,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";

/** Connects the organization's own Slack app so alert messages get Resolve/Ignore/Assign buttons. */
function OrgSlackAppCard({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const settingsQuery = useGetOrganizationSlackSettings(orgSlug, {
    query: { enabled: canManage, retry: false },
  });
  const settings = settingsQuery.data?.data;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetOrganizationSlackSettingsQueryKey(orgSlug) });
  const updateMutation = useUpdateOrganizationSlackSettings({
    mutation: { onSuccess: invalidate },
  });
  const deleteMutation = useDeleteOrganizationSlackSettings({
    mutation: { onSuccess: invalidate },
  });

  if (!canManage) return null;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await updateMutation.mutateAsync({
        orgSlug,
        data: {
          signingSecret: String(data.get("signingSecret") ?? ""),
          botToken: String(data.get("botToken") ?? ""),
        },
      });
      form.reset();
      toast.success("Slack app connected");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" /> Slack app
        </CardTitle>
        <CardDescription>
          Adds Resolve, Ignore and Assign to me buttons to Slack alerts. People act as the
          SpicyTrack member with the same email, within that member&apos;s permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {settingsQuery.isError ? (
          <QueryError
            error={settingsQuery.error}
            onRetry={() => void settingsQuery.refetch()}
            title="Could not load the Slack configuration"
          />
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {settingsQuery.isPending ? (
          <SkeletonRows rows={2} />
        ) : settings ? (
          <>
            {settings.configured ? (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Connected to {settings.teamName || settings.teamId}. New Slack alerts include
                    issue actions.
                  </span>
                  <ConfirmDialog
                    confirmLabel="Disconnect"
                    description="Slack alerts keep working, without the action buttons. Buttons on past messages stop working."
                    onConfirm={async () => {
                      await deleteMutation.mutateAsync({ orgSlug });
                    }}
                    successMessage="Slack app disconnected"
                    title="Disconnect the Slack app?"
                    trigger={
                      <Button size="sm" variant="outline">
                        Disconnect
                      </Button>
                    }
                  />
                </AlertDescription>
              </Alert>
            ) : null}

            <ol className="grid list-decimal gap-3 pl-5 text-sm">
              <li>
                <div className="grid min-w-0 gap-2">
                  <span>
                    Create an app from this manifest at{" "}
                    <a
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                      href="https://api.slack.com/apps?new_app=1"
                      rel="noreferrer"
                      target="_blank"
                    >
                      api.slack.com/apps <ExternalLink className="size-3" />
                    </a>{" "}
                    (From a manifest, JSON), then install it to your workspace.
                  </span>
                  <div className="relative min-w-0">
                    <pre
                      aria-label="Slack app manifest"
                      className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 pr-10 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      tabIndex={0}
                    >
                      {settings.manifest}
                    </pre>
                    <CopyButton
                      className="absolute top-1.5 right-1.5"
                      label="Copy manifest"
                      successMessage="Manifest copied"
                      value={settings.manifest}
                    />
                  </div>
                  <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                    Interactivity Request URL:
                    <code className="truncate text-xs">{settings.requestUrl}</code>
                    <CopyButton
                      label="Copy Request URL"
                      successMessage="Request URL copied"
                      value={settings.requestUrl}
                    />
                  </span>
                </div>
              </li>
              <li>
                Use the incoming webhook URL Slack gives you as the destination of your Slack alert
                rules.
              </li>
              <li>
                <div className="grid gap-3">
                  <span>Paste the app&apos;s credentials. SpicyTrack checks them with Slack.</span>
                  <form className="grid gap-4" onSubmit={save}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field hint="Basic Information → App Credentials" label="Signing secret">
                        <Input autoComplete="off" name="signingSecret" required type="password" />
                      </Field>
                      <Field hint="OAuth & Permissions" label="Bot User OAuth Token">
                        <Input
                          autoComplete="off"
                          name="botToken"
                          placeholder="xoxb-…"
                          required
                          type="password"
                        />
                      </Field>
                    </div>
                    <div>
                      <Button disabled={updateMutation.isPending} type="submit">
                        {updateMutation.isPending
                          ? "Checking…"
                          : settings.configured
                            ? "Replace credentials"
                            : "Connect Slack app"}
                      </Button>
                    </div>
                  </form>
                </div>
              </li>
            </ol>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { OrgSlackAppCard };
