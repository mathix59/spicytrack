import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getGetOrganizationAiSettingsQueryKey,
  type UpdateOrganizationAiSettingsBodyDtoProvider,
  useGetOrganizationAiSettings,
  useUpdateOrganizationAiSettings,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";
import { orvalFetch } from "@/lib/orval-fetch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const PROVIDERS = [
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-5",
    keyPlaceholder: "sk-ant-…",
  },
  { value: "openai", label: "OpenAI (GPT)", defaultModel: "gpt-5.4", keyPlaceholder: "sk-…" },
  {
    value: "google",
    label: "Google (Gemini)",
    defaultModel: "gemini-3.5-flash",
    keyPlaceholder: "AIza…",
  },
] as const;

type AiUsageSummary = {
  days: number;
  totals: {
    runs: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedCostMicros: number | null;
  };
};

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asProvider(value: string): UpdateOrganizationAiSettingsBodyDtoProvider {
  if (value === "openai" || value === "google") {
    return value;
  }

  return "anthropic";
}

function OrgAiSettingsCard({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedProvider, setSelectedProvider] =
    useState<UpdateOrganizationAiSettingsBodyDtoProvider | null>(null);
  const [pricingOverrides, setPricingOverrides] = useState("");

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
    queryKey: ["organization-ai-pricing-overrides", orgSlug],
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
      await queryClient.invalidateQueries({
        queryKey: ["organization-ai-pricing-overrides", orgSlug],
      });
    },
  });
  const settings = settingsQuery.data?.data;
  const provider = selectedProvider ?? settings?.provider ?? "anthropic";
  const providerMeta = PROVIDERS.find((entry) => entry.value === provider) ?? PROVIDERS[0];

  const updateMutation = useUpdateOrganizationAiSettings({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetOrganizationAiSettingsQueryKey(orgSlug),
        });
      },
    },
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const formData = new FormData(event.currentTarget);
    const key = String(formData.get("apiKey") ?? "").trim();
    const model = String(formData.get("model") ?? "").trim();
    const providerChanged = provider !== (settings?.provider ?? "anthropic");

    if (!key && (providerChanged || !settings?.apiKeySet)) {
      setError("Enter the API key for the selected provider.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        orgSlug,
        data: {
          provider: asProvider(provider),
          model: (model || null) as never,
          ...(key ? { apiKey: key as never } : {}),
        },
      });
      setSaved(true);
      event.currentTarget?.reset();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  const clear = async () => {
    setError(null);
    setSaved(false);

    try {
      await updateMutation.mutateAsync({
        orgSlug,
        data: { apiKey: null as never },
      });
    } catch (clearError) {
      setError(getErrorMessage(clearError));
    }
  };

  const saveOverrides = async () => {
    setError(null);
    try {
      const overrides = pricingOverrides.trim() ? JSON.parse(pricingOverrides) : [];
      if (!Array.isArray(overrides)) throw new Error("Overrides must be a JSON array.");
      await overridesMutation.mutateAsync(overrides);
      setPricingOverrides(JSON.stringify(overrides, null, 2));
    } catch (overrideError) {
      setError(getErrorMessage(overrideError));
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Only organization owners and admins can manage AI settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          The AI provider used by the autofix feature for every project in this organization.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {saved ? (
          <Alert>
            <AlertDescription>AI settings saved.</AlertDescription>
          </Alert>
        ) : null}

        {settings?.apiKeySet ? (
          <p className="text-sm">
            Current key ({settings.provider}):{" "}
            <code className="rounded bg-muted/30 px-1.5 py-0.5 text-xs">
              {asOptionalString(settings.maskedKey)}
            </code>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No API key configured.</p>
        )}

        {usageQuery.data ? (
          <div className="grid gap-2 rounded-lg border border-border bg-muted/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                AI usage · last {usageQuery.data.days} days
              </span>
              {usageQuery.data.totals.estimatedCostMicros != null ? (
                <span className="text-sm font-medium">
                  ${(usageQuery.data.totals.estimatedCostMicros / 1_000_000).toFixed(4)} est.
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Pricing not configured</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {usageQuery.data.totals.runs.toLocaleString()} AI run
              {usageQuery.data.totals.runs === 1 ? "" : "s"} ·{" "}
              {usageQuery.data.totals.inputTokens.toLocaleString()} input ·{" "}
              {usageQuery.data.totals.outputTokens.toLocaleString()} output ·{" "}
              {usageQuery.data.totals.cacheReadTokens.toLocaleString()} cache read
            </p>
            {usageQuery.data.totals.estimatedCostMicros == null ? (
              <p className="text-xs text-muted-foreground">
                Set <code>AI_PRICING_JSON</code> on the API to turn token usage into estimated cost.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2 rounded-lg border border-border p-3">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">Pricing overrides</span>
            <p className="text-xs text-muted-foreground">
              Override the community catalog for negotiated rates or a provider-specific deployment.
              Overrides are organization-only and take priority for new usage.
            </p>
          </div>
          <textarea
            className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onChange={(event) => setPricingOverrides(event.target.value)}
            placeholder={JSON.stringify(
              [
                {
                  provider: "openai",
                  model: "gpt-5.4",
                  conditions: { processingMode: "standard" },
                  ratesPerMillion: { input_tokens: 2.25, output_tokens: 13.5 },
                },
              ],
              null,
              2,
            )}
            value={
              pricingOverrides ||
              (overridesQuery.data?.length ? JSON.stringify(overridesQuery.data, null, 2) : "")
            }
          />
          <div className="flex items-center gap-2">
            <Button
              disabled={overridesMutation.isPending}
              onClick={() => void saveOverrides()}
              size="sm"
              type="button"
              variant="outline"
            >
              {overridesMutation.isPending ? "Saving…" : "Save overrides"}
            </Button>
            {overridesQuery.data?.length ? (
              <Button
                disabled={overridesMutation.isPending}
                onClick={() => {
                  setPricingOverrides("");
                  void overridesMutation.mutateAsync([]);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear overrides
              </Button>
            ) : null}
          </div>
        </div>

        <form className="grid gap-4" onSubmit={submit}>
          <Field label="Provider">
            <Select
              onChange={(event) => setSelectedProvider(asProvider(event.target.value))}
              value={provider}
            >
              {PROVIDERS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-1">
            <span className="text-sm font-medium">Recommended model</span>
            <p className="text-sm text-muted-foreground">{providerMeta.defaultModel}</p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Use a custom model (advanced)</summary>
              <div className="mt-2">
                <Input
                  defaultValue={
                    provider === settings?.provider ? asOptionalString(settings?.model) : ""
                  }
                  key={`${provider}-${asOptionalString(settings?.model)}`}
                  name="model"
                  placeholder={providerMeta.defaultModel}
                />
              </div>
            </details>
          </div>
          <Field
            hint={
              settings?.apiKeySet && provider === settings.provider
                ? "Leave empty to keep the stored key."
                : "Stored encrypted."
            }
            label="API key"
          >
            <Input
              autoComplete="off"
              name="apiKey"
              placeholder={providerMeta.keyPlaceholder}
              type="password"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button disabled={updateMutation.isPending} type="submit">
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
            {settings?.apiKeySet ? (
              <Button
                disabled={updateMutation.isPending}
                onClick={clear}
                type="button"
                variant="ghost"
              >
                Clear key
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export { OrgAiSettingsCard };
