import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getGetOrganizationAiSettingsQueryKey,
  type UpdateOrganizationAiSettingsBodyDtoProvider,
  useGetOrganizationAiSettings,
  useUpdateOrganizationAiSettings,
} from "@/generated/api";
import { orvalFetch } from "@/lib/orval-fetch";
import { getErrorMessage } from "@/lib/utils";

import { AI_PROVIDERS, type AiUsageSummary, asAiProvider } from "./ai-settings-constants";

function useOrgAiSettings({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<UpdateOrganizationAiSettingsBodyDtoProvider | null>(null);
  const [pricingOverrides, setPricingOverrides] = useState("");
  const overridesKey = ["organization-ai-pricing-overrides", orgSlug];

  const settingsQuery = useGetOrganizationAiSettings(orgSlug, {
    query: { enabled: canManage, retry: false },
  });
  const usageQuery = useQuery({
    queryKey: ["organization-ai-usage", orgSlug],
    queryFn: () =>
      orvalFetch<{ data: AiUsageSummary }>(`/organizations/${orgSlug}/settings/ai/usage`, {
        method: "GET",
      }).then((response) => response.data),
    enabled: canManage,
    retry: false,
  });
  const overridesQuery = useQuery({
    queryKey: overridesKey,
    queryFn: () =>
      orvalFetch<{ data: unknown[] }>(`/organizations/${orgSlug}/settings/ai/pricing-overrides`, {
        method: "GET",
      }).then((response) => response.data),
    enabled: canManage,
    retry: false,
  });
  const overridesMutation = useMutation({
    mutationFn: (overrides: unknown[]) =>
      orvalFetch(`/organizations/${orgSlug}/settings/ai/pricing-overrides`, {
        method: "PUT",
        body: JSON.stringify({ overrides }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: overridesKey });
    },
  });
  const updateMutation = useUpdateOrganizationAiSettings({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetOrganizationAiSettingsQueryKey(orgSlug),
        });
      },
    },
  });

  const settings = settingsQuery.data?.data;
  const provider = selectedProvider ?? settings?.provider ?? "anthropic";
  const providerMeta = AI_PROVIDERS.find((entry) => entry.value === provider) ?? AI_PROVIDERS[0];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const key = String(formData.get("apiKey") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const providerChanged = provider !== (settings?.provider ?? "anthropic");

    if (!key && (providerChanged || !settings?.apiKeySet)) {
      setFormError("Enter the API key for the selected provider.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        orgSlug,
        data: {
          provider: asAiProvider(provider),
          model: (model || null) as never,
          ...(key ? { apiKey: key as never } : {}),
        },
      });
      toast.success("AI settings saved");
      form.reset();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  };

  /** Rethrows so the confirmation dialog can show the failure. */
  const clearKey = async () => {
    setFormError(null);
    await updateMutation.mutateAsync({ orgSlug, data: { apiKey: null as never } });
  };

  const saveOverrides = async () => {
    setOverridesError(null);
    let overrides: unknown;
    try {
      overrides = pricingOverrides.trim() ? JSON.parse(pricingOverrides) : [];
    } catch {
      setOverridesError("Overrides must be valid JSON.");
      return;
    }
    if (!Array.isArray(overrides)) {
      setOverridesError("Overrides must be a JSON array.");
      return;
    }
    try {
      await overridesMutation.mutateAsync(overrides);
      setPricingOverrides(JSON.stringify(overrides, null, 2));
      toast.success("Pricing overrides saved");
    } catch (overrideError) {
      setOverridesError(getErrorMessage(overrideError));
    }
  };

  const clearOverrides = async () => {
    setOverridesError(null);
    await overridesMutation.mutateAsync([]);
    setPricingOverrides("");
  };

  return {
    settings,
    settingsQuery,
    usage: usageQuery.data,
    provider,
    providerMeta,
    formError,
    overridesError,
    overridesText:
      pricingOverrides ||
      (overridesQuery.data?.length ? JSON.stringify(overridesQuery.data, null, 2) : ""),
    hasStoredOverrides: Boolean(overridesQuery.data?.length),
    isSaving: updateMutation.isPending,
    isSavingOverrides: overridesMutation.isPending,
    setProvider: (value: string) => setSelectedProvider(asAiProvider(value)),
    setPricingOverrides,
    submit,
    clearKey,
    saveOverrides,
    clearOverrides,
  };
}

type OrgAiSettingsState = ReturnType<typeof useOrgAiSettings>;

export { useOrgAiSettings };
export type { OrgAiSettingsState };
