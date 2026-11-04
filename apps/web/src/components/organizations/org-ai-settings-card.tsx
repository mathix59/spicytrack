import { useRef } from "react";
import { KeyRound } from "lucide-react";

import { CollapsibleSection } from "@/components/common/collapsible-section";
import { QueryError } from "@/components/common/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";

import { AiBudgetForm } from "./ai-settings/ai-budget-form";
import { AiPricingOverrides } from "./ai-settings/ai-pricing-overrides";
import { AiProviderForm } from "./ai-settings/ai-provider-form";
import { AiUsageSummary } from "./ai-settings/ai-usage-summary";
import { useOrgAiSettings } from "./ai-settings/use-org-ai-settings";

function OrgAiSettingsCard({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const state = useOrgAiSettings({ orgSlug, canManage });
  const { settings, settingsQuery } = state;
  const keyInputRef = useRef<HTMLInputElement>(null);

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

  const hasKey = Boolean(settings?.apiKeySet);

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
            {hasKey ? null : (
              <EmptyState
                action={
                  <Button onClick={() => keyInputRef.current?.focus()} type="button">
                    <KeyRound />
                    Add an API key
                  </Button>
                }
                description="Autofix and AI triage need an API key from Anthropic, OpenAI or Google. One key serves every project in this organization; usage and spending limits appear once it is saved."
                icon={KeyRound}
                title="No AI provider key yet"
              />
            )}
            <AiProviderForm keyInputRef={keyInputRef} state={state} />
            {hasKey ? (
              <>
                {state.usage ? <AiUsageSummary usage={state.usage} /> : null}
                <AiBudgetForm state={state} />
                <CollapsibleSection
                  defaultOpen={false}
                  summary="Pricing overrides"
                  title="Advanced"
                >
                  <AiPricingOverrides state={state} />
                </CollapsibleSection>
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { OrgAiSettingsCard };
