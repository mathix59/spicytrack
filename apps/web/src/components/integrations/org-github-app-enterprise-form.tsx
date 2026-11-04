import type { FormEvent } from "react";

import type { OrganizationGithubAppSettingsDto } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { asOptionalString } from "./org-github-app-utils";

function OrgGithubAppEnterpriseForm({
  settings,
  isPending,
  onSubmit,
}: {
  settings: OrganizationGithubAppSettingsDto | undefined;
  isPending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    // Keyed on the loaded settings so the uncontrolled inputs pick up fresh values.
    <form
      className="grid gap-4"
      key={JSON.stringify([
        settings?.htmlUrl,
        settings?.apiUrl,
        settings?.gitUser,
        settings?.gitPort,
        settings?.appSlug,
        settings?.appId,
        settings?.clientId,
      ])}
      onSubmit={onSubmit}
    >
      <Alert>
        <AlertDescription>
          GitHub Enterprise Server does not always support the Manifest flow. These advanced fields
          remain available for administrators.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="HTML URL">
          <Input
            defaultValue={asOptionalString(settings?.htmlUrl)}
            name="htmlUrl"
            placeholder="https://github.example.com"
            required
          />
        </Field>
        <Field label="API URL">
          <Input
            defaultValue={asOptionalString(settings?.apiUrl)}
            name="apiUrl"
            placeholder="https://github.example.com/api/v3"
            required
          />
        </Field>
        <Field label="Git user">
          <Input defaultValue={asOptionalString(settings?.gitUser) || "git"} name="gitUser" />
        </Field>
        <Field label="Git port">
          <Input
            defaultValue={String(settings?.gitPort ?? 22)}
            min="1"
            name="gitPort"
            type="number"
          />
        </Field>
        <Field label="App slug">
          <Input defaultValue={asOptionalString(settings?.appSlug)} name="appSlug" required />
        </Field>
        <Field label="App ID">
          <Input defaultValue={asOptionalString(settings?.appId)} name="appId" required />
        </Field>
        <Field label="Client ID">
          <Input defaultValue={asOptionalString(settings?.clientId)} name="clientId" />
        </Field>
        <Field label="Client secret">
          <Input autoComplete="off" name="clientSecret" type="password" />
        </Field>
      </div>
      <Field label="Private key">
        <textarea
          className="min-h-36 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          name="privateKey"
        />
      </Field>
      <Field label="Webhook secret">
        <Input autoComplete="off" name="webhookSecret" type="password" />
      </Field>
      <div>
        <Button disabled={isPending} type="submit">
          {isPending ? "Saving…" : "Save advanced configuration"}
        </Button>
      </div>
    </form>
  );
}

export { OrgGithubAppEnterpriseForm };
