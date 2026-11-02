import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getGetAutofixConfigQueryKey,
  useGetAutofixConfig,
  useUpdateAutofixConfig,
} from "@/generated/api";
import { HttpError } from "@/lib/orval-fetch";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function AutofixConfigCard({
  orgSlug,
  projectSlug,
  canManage,
  hasConnection,
}: {
  orgSlug: string;
  projectSlug: string;
  canManage: boolean;
  hasConnection: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [autoTrigger, setAutoTrigger] = useState(false);
  const [autoMerge, setAutoMerge] = useState(false);

  const configQuery = useGetAutofixConfig(orgSlug, projectSlug);
  const config = configQuery.data?.data;

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setAutoTrigger(config.autoTriggerOnNewIssue);
      setAutoMerge(config.autoMerge);
    }
  }, [config]);

  const updateMutation = useUpdateAutofixConfig({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetAutofixConfigQueryKey(orgSlug, projectSlug),
        });
      },
    },
  });

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const dailyCap = Number(formData.get("dailyCap") ?? 5);
    const targetBranch = String(formData.get("targetBranch") ?? "").trim();

    try {
      await updateMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          enabled,
          autoTriggerOnNewIssue: autoTrigger,
          autoMerge,
          dailyCap: Number.isFinite(dailyCap) ? dailyCap : 5,
          targetBranch: (targetBranch || null) as never,
        },
      });
      toast.success("Autofix configuration saved");
    } catch (submitError) {
      setError(
        submitError instanceof HttpError
          ? submitError.message
          : "Failed to save the autofix configuration",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI autofix</CardTitle>
        <CardDescription>
          Let SpicyTrack open pull requests that propose fixes for this project&apos;s issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasConnection ? (
          <Alert variant="warning">
            <AlertDescription>Connect a repository first to enable autofix.</AlertDescription>
          </Alert>
        ) : null}

        {configQuery.isLoading ? (
          <SkeletonRows rows={4} />
        ) : configQuery.error ? (
          <QueryError
            error={configQuery.error}
            onRetry={() => void configQuery.refetch()}
            title="Could not load the autofix configuration"
          />
        ) : (
          <form className="grid gap-4" onSubmit={save}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Enable autofix</p>
                <p className="text-xs text-muted-foreground">
                  Allow triggering AI fixes for issues in this project.
                </p>
              </div>
              <Switch
                aria-label="Enable autofix"
                checked={enabled}
                disabled={!canManage}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Automatically merge successful fixes</p>
                <p className="text-xs text-muted-foreground">
                  Squash the generated pull request into the explicit target branch when the forge
                  accepts it. Branch protections still apply.
                </p>
              </div>
              <Switch
                aria-label="Automatically merge successful fixes"
                checked={autoMerge}
                disabled={!canManage || !enabled}
                onCheckedChange={setAutoMerge}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Auto-trigger on new issues</p>
                <p className="text-xs text-muted-foreground">
                  Start an autofix automatically when a new issue is created.
                </p>
              </div>
              <Switch
                aria-label="Auto-trigger on new issues"
                checked={autoTrigger}
                disabled={!canManage || !enabled}
                onCheckedChange={setAutoTrigger}
              />
            </div>

            <Field hint="Maximum automatic runs per day for this project." label="Daily cap">
              <Input
                defaultValue={config?.dailyCap ?? 5}
                disabled={!canManage}
                key={config?.dailyCap ?? "cap"}
                max={100}
                min={1}
                name="dailyCap"
                type="number"
              />
            </Field>

            <Field
              hint={
                autoMerge
                  ? "Required for automatic merge. Example: autofixe."
                  : "Branch PRs are opened against. Empty = repository default branch."
              }
              label="Target branch"
            >
              <Input
                defaultValue={asOptionalString(config?.targetBranch)}
                disabled={!canManage}
                key={asOptionalString(config?.targetBranch) || "branch"}
                name="targetBranch"
                placeholder={autoMerge ? "autofixe" : "main"}
                required={autoMerge}
              />
            </Field>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div>
              <Button disabled={!canManage || updateMutation.isPending} type="submit">
                {updateMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export { AutofixConfigCard };
