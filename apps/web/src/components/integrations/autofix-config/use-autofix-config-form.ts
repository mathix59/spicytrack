import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  type AutofixConfigDto,
  getGetAutofixAvailabilityQueryKey,
  getGetAutofixConfigQueryKey,
  useGetAutofixConfig,
  useUpdateAutofixConfig,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";

type AutofixFormValues = {
  enabled: boolean;
  autoTriggerOnNewIssue: boolean;
  autoFixAfterAnalysis: boolean;
  requirePassingChecks: boolean;
  autoMerge: boolean;
  dailyCap: string;
  targetBranch: string;
};

const DEFAULT_DAILY_CAP = 5;

function valuesFromConfig(config: AutofixConfigDto | undefined): AutofixFormValues {
  return {
    enabled: config?.enabled ?? false,
    autoTriggerOnNewIssue: config?.autoTriggerOnNewIssue ?? false,
    autoFixAfterAnalysis: config?.autoFixAfterAnalysis ?? false,
    requirePassingChecks: config?.requirePassingChecks ?? true,
    autoMerge: config?.autoMerge ?? false,
    dailyCap: String(config?.dailyCap ?? DEFAULT_DAILY_CAP),
    targetBranch: typeof config?.targetBranch === "string" ? config.targetBranch : "",
  };
}

function sameValues(left: AutofixFormValues, right: AutofixFormValues) {
  return (Object.keys(left) as (keyof AutofixFormValues)[]).every(
    (key) => String(left[key]).trim() === String(right[key]).trim(),
  );
}

/**
 * Autofix settings edited as a draft: toggles change the draft only, `dirty` tells the card to
 * show its unsaved-changes cue, and nothing reaches the API until Save.
 */
function useAutofixConfigForm({ orgSlug, projectSlug }: { orgSlug: string; projectSlug: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const configQuery = useGetAutofixConfig(orgSlug, projectSlug);
  const config = configQuery.data?.data;
  const saved = valuesFromConfig(config);
  const [values, setValues] = useState<AutofixFormValues>(saved);

  // Re-seed the draft whenever the query yields a new config (initial load or refetch).
  const [seededConfig, setSeededConfig] = useState<typeof config>(undefined);
  if (config !== seededConfig) {
    setSeededConfig(config);
    setValues(valuesFromConfig(config));
  }

  const updateMutation = useUpdateAutofixConfig({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetAutofixConfigQueryKey(orgSlug, projectSlug),
          }),
          queryClient.invalidateQueries({
            queryKey: getGetAutofixAvailabilityQueryKey(orgSlug, projectSlug),
          }),
        ]);
      },
    },
  });

  const setValue = <Key extends keyof AutofixFormValues>(
    key: Key,
    value: AutofixFormValues[Key],
  ) => {
    setError(null);
    setValues((current) => ({ ...current, [key]: value }));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const dailyCap = Number(values.dailyCap);
    const targetBranch = values.targetBranch.trim();

    try {
      await updateMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          enabled: values.enabled,
          autoTriggerOnNewIssue: values.autoTriggerOnNewIssue,
          autoMerge: values.autoMerge,
          autoFixAfterAnalysis: values.autoFixAfterAnalysis,
          requirePassingChecks: values.requirePassingChecks,
          dailyCap: Number.isFinite(dailyCap) && dailyCap > 0 ? dailyCap : DEFAULT_DAILY_CAP,
          targetBranch: (targetBranch || null) as never,
        },
      });
      toast.success("Autofix configuration saved");
    } catch (submitError) {
      setError(getErrorMessage(submitError) || "Failed to save the autofix configuration");
    }
  };

  return {
    configQuery,
    values,
    setValue,
    dirty: Boolean(config) && !sameValues(values, saved),
    discard: () => {
      setError(null);
      setValues(saved);
    },
    save,
    error,
    isSaving: updateMutation.isPending,
  };
}

export { useAutofixConfigForm };
export type { AutofixFormValues };
