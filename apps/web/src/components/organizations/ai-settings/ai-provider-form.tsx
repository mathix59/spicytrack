import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { AI_PROVIDERS, asOptionalString } from "./ai-settings-constants";
import type { OrgAiSettingsState } from "./use-org-ai-settings";

function AiProviderForm({ state }: { state: OrgAiSettingsState }) {
  const { settings, provider, providerMeta } = state;
  const storedModel = asOptionalString(settings?.model);

  return (
    <form className="grid gap-4" onSubmit={(event) => void state.submit(event)}>
      <Field label="Provider">
        <Select onChange={(event) => state.setProvider(event.target.value)} value={provider}>
          {AI_PROVIDERS.map((entry) => (
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
              aria-label="Custom model"
              defaultValue={provider === settings?.provider ? storedModel : ""}
              key={`${provider}-${storedModel}`}
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
      {state.formError ? (
        <Alert variant="destructive">
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-center gap-2">
        <Button disabled={state.isSaving} type="submit">
          {state.isSaving ? "Saving…" : "Save"}
        </Button>
        {settings?.apiKeySet ? (
          <ConfirmDialog
            confirmLabel="Clear key"
            description="Autofix and other AI features stop working for every project in this organization until a new key is saved."
            onConfirm={state.clearKey}
            successMessage="API key cleared"
            title="Clear the AI provider key?"
            trigger={
              <Button disabled={state.isSaving} type="button" variant="ghost">
                Clear key
              </Button>
            }
          />
        ) : null}
      </div>
    </form>
  );
}

export { AiProviderForm };
