import { useId } from "react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { PRICING_OVERRIDES_PLACEHOLDER } from "./ai-settings-constants";
import type { OrgAiSettingsState } from "./use-org-ai-settings";

function AiPricingOverrides({ state }: { state: OrgAiSettingsState }) {
  const labelId = useId();
  const hintId = useId();

  return (
    <div className="grid gap-2 p-3">
      <div className="grid gap-0.5">
        <span className="text-sm font-medium" id={labelId}>
          Pricing overrides
        </span>
        <p className="text-xs text-muted-foreground" id={hintId}>
          Override the community catalog for negotiated rates or a provider-specific deployment.
          Overrides are organization-only and take priority for new usage.
        </p>
      </div>
      <Textarea
        aria-describedby={hintId}
        aria-labelledby={labelId}
        className="min-h-36 font-mono text-xs"
        onChange={(event) => state.setPricingOverrides(event.target.value)}
        placeholder={PRICING_OVERRIDES_PLACEHOLDER}
        value={state.overridesText}
      />
      {state.overridesError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.overridesError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={state.isSavingOverrides}
          onClick={() => void state.saveOverrides()}
          type="button"
        >
          {state.isSavingOverrides ? "Saving…" : "Save overrides"}
        </Button>
        {state.hasStoredOverrides ? (
          <ConfirmDialog
            confirmLabel="Clear overrides"
            description="New AI usage will be priced with the community catalog again."
            onConfirm={state.clearOverrides}
            successMessage="Pricing overrides cleared"
            title="Clear pricing overrides?"
            trigger={
              <Button disabled={state.isSavingOverrides} type="button" variant="ghost">
                Clear overrides
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  );
}

export { AiPricingOverrides };
