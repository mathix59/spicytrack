import { type FormEvent, useState } from "react";
import { PlugZap, Save } from "lucide-react";

import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/utils";

import { testSmtpConnection } from "./instance-admin-api";
import type { InstanceSettings, InstanceSettingsUpdate } from "./types";

type SmtpAction = "test" | "save";

export function SmtpTab({
  settings,
  onSave,
}: {
  settings: InstanceSettings;
  onSave: (next: InstanceSettingsUpdate) => Promise<unknown>;
}) {
  const [value, setValue] = useState(settings);
  const [pass, setPass] = useState("");
  const [pendingAction, setPendingAction] = useState<SmtpAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  // Reset the form whenever fresh settings arrive (initial load or after saving).
  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (syncedSettings !== settings) {
    setSyncedSettings(settings);
    setValue(settings);
  }

  const run = async (action: SmtpAction) => {
    setPendingAction(action);
    setError(null);
    setTestResult(null);
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpFrom } = value;
    const input = {
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpFrom,
      smtpPass: pass || undefined,
    };
    try {
      if (action === "test") {
        await testSmtpConnection(input);
        setTestResult("SMTP connection successful.");
      } else {
        await onSave(input);
        setPass("");
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setPendingAction(null);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run("save");
  };

  return (
    <Card className="overflow-hidden">
      <OrganizationSectionHeader
        action={
          <Badge variant={settings.smtpHost ? "success" : "muted"}>
            {settings.smtpHost ? "Configured" : "Not configured"}
          </Badge>
        }
        description="Used for invitations, password resets and email verification."
        title="SMTP delivery"
      />
      <CardContent>
        <form className="grid gap-6" onSubmit={submit}>
          <fieldset className="grid gap-4">
            <legend className="mb-3 text-sm font-semibold">Server</legend>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Host">
                <Input
                  autoComplete="off"
                  placeholder="smtp.example.com"
                  value={value.smtpHost ?? ""}
                  onChange={(e) => setValue({ ...value, smtpHost: e.target.value || null })}
                />
              </Field>
              <Field label="Port">
                <Input
                  inputMode="numeric"
                  placeholder="587"
                  type="number"
                  value={value.smtpPort ?? ""}
                  onChange={(e) =>
                    setValue({
                      ...value,
                      smtpPort: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Connection security">
              <Select
                value={value.smtpSecure == null ? "auto" : String(value.smtpSecure)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    smtpSecure: e.target.value === "auto" ? null : e.target.value === "true",
                  })
                }
              >
                <option value="auto">Automatic (TLS on port 465)</option>
                <option value="true">Implicit TLS (usually port 465)</option>
                <option value="false">STARTTLS when available (usually port 587)</option>
              </Select>
            </Field>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">Authentication</legend>
            <Field label="Username">
              <Input
                autoComplete="off"
                value={value.smtpUser ?? ""}
                onChange={(e) => setValue({ ...value, smtpUser: e.target.value || null })}
              />
            </Field>
            <Field
              label={value.smtpPasswordConfigured ? "Password (leave blank to keep)" : "Password"}
            >
              <Input
                autoComplete="new-password"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </Field>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="mb-3 text-sm font-semibold">Sender</legend>
            <Field label="From address">
              <Input
                placeholder="SpicyTrack <alerts@example.com>"
                value={value.smtpFrom ?? ""}
                onChange={(e) => setValue({ ...value, smtpFrom: e.target.value || null })}
              />
            </Field>
          </fieldset>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {testResult ? (
            <Alert role="status" variant="success">
              <AlertDescription>{testResult}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Test the connection without saving settings or sending an email.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pendingAction !== null}
                onClick={() => void run("test")}
                type="button"
                variant="outline"
              >
                <PlugZap />
                {pendingAction === "test" ? "Testing…" : "Test connection"}
              </Button>
              <Button disabled={pendingAction !== null} type="submit">
                <Save />
                {pendingAction === "save" ? "Saving…" : "Save SMTP settings"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
