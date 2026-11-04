import { useState } from "react";
import { Link } from "react-router-dom";

import { useGetAutofixAvailability } from "@/generated/api";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { useAutofixConfigForm } from "./autofix-config/use-autofix-config-form";

const LINK_CLASS_NAME = "font-medium underline underline-offset-2";
const TARGET_BRANCH_HINT =
  "Base branch for pull requests. Leave empty to use the repository's default branch.";
const AUTO_MERGE_TARGET_BRANCH_HINT =
  "Base branch for pull requests. Required for automatic merge: fixes are squashed into it.";

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
  repositoryHref,
}: {
  orgSlug: string;
  projectSlug: string;
  canManage: boolean;
  hasConnection: boolean;
  /** Where the "connect a repository" alert sends people: the Repository integration tab. */
  repositoryHref: string;
}) {
  const form = useAutofixConfigForm({ orgSlug, projectSlug });
  const { configQuery, values, setValue } = form;
  const [confirmAutoMerge, setConfirmAutoMerge] = useState(false);
  const availabilityQuery = useGetAutofixAvailability(orgSlug, projectSlug, {
    query: { retry: false },
  });
  const missingAiKey = availabilityQuery.data?.data.missing.includes("ai_key") ?? false;

  const locked = !canManage || !hasConnection;
  const optionsLocked = locked || !values.enabled;

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
            <AlertDescription>
              Autofix needs a repository.{" "}
              <Link className={LINK_CLASS_NAME} to={repositoryHref}>
                Connect one in the Repository tab
              </Link>{" "}
              to turn it on.
            </AlertDescription>
          </Alert>
        ) : null}
        {missingAiKey ? (
          <Alert variant="warning">
            <AlertDescription>
              The organization has no AI provider key, so analyses and fixes cannot run. Add one in{" "}
              <Link className={LINK_CLASS_NAME} to={`/orgs/${orgSlug}?tab=settings&section=ai`}>
                Organization settings → AI
              </Link>
              .
            </AlertDescription>
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
          <form className="grid gap-4" onSubmit={(event) => void form.save(event)}>
            <ToggleRow
              checked={values.enabled}
              description="Allow AI root-cause analyses and fixes for issues in this project."
              disabled={locked}
              label="Enable autofix"
              onCheckedChange={(checked) => setValue("enabled", checked)}
            />
            <ToggleRow
              checked={values.autoTriggerOnNewIssue}
              description="Analyze the root cause of each new issue automatically. Analyses never change code."
              disabled={optionsLocked}
              label="Analyze new issues automatically"
              onCheckedChange={(checked) => setValue("autoTriggerOnNewIssue", checked)}
            />
            <ToggleRow
              checked={values.autoFixAfterAnalysis}
              description="Generate the fix without waiting for someone when the analysis is fixable with medium or high confidence."
              disabled={optionsLocked}
              label="Generate fixes automatically"
              onCheckedChange={(checked) => setValue("autoFixAfterAnalysis", checked)}
            />
            <ToggleRow
              checked={values.requirePassingChecks}
              description="Without any CI check on the fix branch, fail the run instead of opening an unverified pull request."
              disabled={optionsLocked}
              label="Require passing CI checks"
              onCheckedChange={(checked) => setValue("requirePassingChecks", checked)}
            />
            <ToggleRow
              checked={values.autoMerge}
              description="Squash the pull request into the explicit target branch, only after CI passed on it. Branch protections still apply."
              disabled={optionsLocked}
              label="Merge automatically when CI passes"
              onCheckedChange={(checked) =>
                checked ? setConfirmAutoMerge(true) : setValue("autoMerge", false)
              }
            />
            <ConfirmDialog
              confirmLabel="Turn on automatic merge"
              description="Fix pull requests will be squash-merged into the target branch as soon as CI passes on them, without waiting for a review. Branch protections still apply. The change takes effect when you save."
              destructive={false}
              onConfirm={() => setValue("autoMerge", true)}
              onOpenChange={setConfirmAutoMerge}
              open={confirmAutoMerge}
              title="Merge fixes automatically?"
            />

            <Field hint="Maximum automatic analyses per day for this project." label="Daily cap">
              <Input
                disabled={locked}
                max={100}
                min={1}
                name="dailyCap"
                onChange={(event) => setValue("dailyCap", event.target.value)}
                type="number"
                value={values.dailyCap}
              />
            </Field>

            <Field
              hint={values.autoMerge ? AUTO_MERGE_TARGET_BRANCH_HINT : TARGET_BRANCH_HINT}
              label="Target branch"
            >
              <Input
                disabled={locked}
                name="targetBranch"
                onChange={(event) => setValue("targetBranch", event.target.value)}
                placeholder="e.g. autofix"
                required={values.autoMerge}
                value={values.targetBranch}
              />
            </Field>

            {form.error ? (
              <Alert variant="destructive">
                <AlertDescription>{form.error}</AlertDescription>
              </Alert>
            ) : null}

            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                // While there are unsaved changes, the actions stay in view as the page scrolls.
                form.dirty && "sticky bottom-0 z-10 -mx-6 border-t border-border bg-card px-6 py-3",
              )}
            >
              <Button disabled={locked || !form.dirty || form.isSaving} type="submit">
                {form.isSaving ? "Saving…" : "Save"}
              </Button>
              {form.dirty ? (
                <Button
                  disabled={form.isSaving}
                  onClick={form.discard}
                  type="button"
                  variant="ghost"
                >
                  Discard
                </Button>
              ) : null}
              <span className="text-sm font-medium text-warning" role="status">
                {form.dirty ? "Unsaved changes" : ""}
              </span>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export { AutofixConfigCard };
