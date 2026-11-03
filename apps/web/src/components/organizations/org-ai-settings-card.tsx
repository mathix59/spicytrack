import { QueryError } from "@/components/common/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonRows } from "@/components/ui/skeleton";

import { AiBudgetForm } from "./ai-settings/ai-budget-form";
import { AiPricingOverrides } from "./ai-settings/ai-pricing-overrides";
import { AiProviderForm } from "./ai-settings/ai-provider-form";
import { asOptionalString } from "./ai-settings/ai-settings-constants";
import { AiUsageSummary } from "./ai-settings/ai-usage-summary";
import { useOrgAiSettings } from "./ai-settings/use-org-ai-settings";

function OrgAiSettingsCard({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const state = useOrgAiSettings({ orgSlug, canManage });
  const { settings, settingsQuery } = state;

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
        <CardDescription>
          The AI provider, and spending limits, for Autofix and AI triage in every project of this
          organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {settingsQuery.isPending ? (
          <SkeletonRows rows={4} />
        ) : settingsQuery.isError ? (
          <QueryError
            error={settingsQuery.error}
            onRetry={() => void settingsQuery.refetch()}
            title="Could not load AI settings"
          />
        ) : (
          <>
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
            {state.usage ? <AiUsageSummary usage={state.usage} /> : null}
            <AiBudgetForm state={state} />
            <AiPricingOverrides state={state} />
            <AiProviderForm state={state} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { OrgAiSettingsCard };
