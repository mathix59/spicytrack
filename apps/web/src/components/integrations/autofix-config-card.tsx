import { useState } from "react";
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

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
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
  const [autoFix, setAutoFix] = useState(false);
  const [requireChecks, setRequireChecks] = useState(true);

  const configQuery = useGetAutofixConfig(orgSlug, projectSlug);
  const config = configQuery.data?.data;

  // Re-seed the form whenever the query yields a new config (initial load or refetch).
  const [seededConfig, setSeededConfig] = useState<typeof config>(undefined);
  if (config !== seededConfig) {
    setSeededConfig(config);
    if (config) {
      setEnabled(config.enabled);
      setAutoTrigger(config.autoTriggerOnNewIssue);
      setAutoMerge(config.autoMerge);
      setAutoFix(config.autoFixAfterAnalysis);
      setRequireChecks(config.requirePassingChecks);
    }
  }

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
          autoFixAfterAnalysis: autoFix,
          requirePassingChecks: requireChecks,
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
          SpicyTrack first finds an issue&apos;s root cause without touching your code. The fix is a
          second, optional step: it is pushed to a branch, and the pull request opens only once your
          CI passes on it.
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
            <ToggleRow
              checked={enabled}
              description="Allow AI root-cause analyses and fixes for issues in this project."
              disabled={!canManage}
              label="Enable autofix"
              onCheckedChange={setEnabled}
            />
            <ToggleRow
              checked={autoTrigger}
              description="Analyze the root cause of each new issue automatically. Analyses never change code."
              disabled={!canManage || !enabled}
              label="Analyze new issues automatically"
              onCheckedChange={setAutoTrigger}
            />
            <ToggleRow
              checked={autoFix}
              description="Generate the fix without waiting for someone when the analysis is fixable with medium or high confidence."
              disabled={!canManage || !enabled}
              label="Generate fixes automatically"
              onCheckedChange={setAutoFix}
            />
            <ToggleRow
              checked={requireChecks}
              description="Without any CI check on the fix branch, fail the run instead of opening an unverified pull request."
              disabled={!canManage || !enabled}
              label="Require passing CI checks"
              onCheckedChange={setRequireChecks}
            />
            <ToggleRow
              checked={autoMerge}
              description="Squash the pull request into the explicit target branch, only after CI passed on it. Branch protections still apply."
              disabled={!canManage || !enabled}
              label="Merge automatically when CI passes"
              onCheckedChange={setAutoMerge}
            />

            <Field hint="Maximum automatic analyses per day for this project." label="Daily cap">
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
