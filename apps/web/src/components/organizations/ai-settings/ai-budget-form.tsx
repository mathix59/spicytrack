import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { OrgAiSettingsState } from "./use-org-ai-settings";

const usd = (value: number) => `$${value.toFixed(2)}`;

/** Monthly AI budget and per-run Autofix cap, with this month's spend. */
function AiBudgetForm({ state }: { state: OrgAiSettingsState }) {
  const { settings } = state;
  if (!settings) return null;

  const budget = settings.monthlyBudgetUsd ?? null;
  const spent = settings.spentThisMonthUsd;
  const ratio = budget ? Math.min(1, spent / budget) : 0;
  const limited = budget !== null || settings.runCostCapUsd != null;

  return (
    <form
      className="grid gap-3 rounded-lg border border-border p-3"
      onSubmit={(event) => void state.saveBudget(event)}
    >
      <div className="grid gap-1">
        <span className="text-sm font-medium">Spending limits</span>
        <p className="text-xs text-muted-foreground">
          New analyses, fixes and triage briefings are refused once the monthly budget is spent. An
          Autofix run stops at the first step that reaches its cap.
        </p>
      </div>

      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>
            {usd(spent)} spent this month{budget !== null ? ` of ${usd(budget)}` : ""}
          </span>
          <span className="text-xs text-muted-foreground">
            Resets{" "}
            {new Date(settings.budgetResetsAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </span>
        </div>
        {budget !== null ? (
          <div
            aria-label="Monthly AI budget used"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(ratio * 100)}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className={cn(
                "h-full rounded-full bg-primary",
                ratio >= 0.9 && "bg-warning",
                ratio >= 1 && "bg-destructive",
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      {limited && !settings.pricingKnown ? (
        <Alert variant="warning">
          <AlertDescription>
            SpicyTrack has no price for the selected model, so it cannot measure spend: AI runs are
            refused while limits are set. Add a pricing override below, or remove the limits.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field hint="Empty means no monthly limit." label="Monthly budget (USD)">
          <Input
            defaultValue={budget ?? ""}
            inputMode="decimal"
            key={`budget-${budget}`}
            max={1_000_000}
            min={0.01}
            name="monthlyBudgetUsd"
            placeholder="No limit"
            step={0.01}
            type="number"
          />
        </Field>
        <Field
          hint="Analysis and fix together. Empty means no cap."
          label="Cap per Autofix run (USD)"
        >
          <Input
            defaultValue={settings.runCostCapUsd ?? ""}
            inputMode="decimal"
            key={`cap-${settings.runCostCapUsd}`}
            max={1000}
            min={0.01}
            name="runCostCapUsd"
            placeholder="No cap"
            step={0.01}
            type="number"
          />
        </Field>
      </div>

      {state.budgetError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.budgetError}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button disabled={state.isSaving} size="sm" type="submit" variant="outline">
          {state.isSaving ? "Saving…" : "Save limits"}
        </Button>
      </div>
    </form>
  );
}

export { AiBudgetForm };
