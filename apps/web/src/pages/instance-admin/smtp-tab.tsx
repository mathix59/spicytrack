import { type FormEvent, useState } from "react";
import { MailCheck, PlugZap, Save } from "lucide-react";

import { useGetMe } from "@/generated/api";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

import { sendSmtpTestEmail, testSmtpConnection } from "./instance-admin-api";
import type { InstanceSettings, InstanceSettingsUpdate } from "./types";
import type { SmtpFormState } from "./use-smtp-form";

type SmtpAction = "test" | "email" | "save";

export function SmtpTab({
  settings,
  form,
  onSave,
}: {
  settings: InstanceSettings;
  form: SmtpFormState;
  onSave: (next: InstanceSettingsUpdate) => Promise<unknown>;
}) {
  const { value, setValue, pass, setPass, isDirty } = form;
  const adminEmail = useGetMe().data?.data.user.email;
  const [pendingAction, setPendingAction] = useState<SmtpAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const canSendTestEmail = Boolean(settings.smtpHost) && !isDirty;

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
      } else if (action === "email") {
        const { to } = await sendSmtpTestEmail();
        setTestResult(`Test email sent to ${to}. Check that inbox (and its spam folder).`);
      } else {
        await onSave(input);
        setPass("");
        toast.success("SMTP settings saved.");
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
                <option value="auto">Automatic (implicit TLS on 465, STARTTLS otherwise)</option>
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
              label={
                settings.smtpPasswordConfigured ? "Password (leave blank to keep)" : "Password"
              }
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

          <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
            <div className="grid gap-1">
              <p className="text-sm font-medium">Check delivery</p>
              <p className="text-sm text-muted-foreground">
                Test the connection with the values above without saving or sending anything, or
                send a real email with the saved settings to{" "}
                {adminEmail ? (
                  <span className="font-medium text-foreground">{adminEmail}</span>
                ) : (
                  "you"
                )}
                .
              </p>
            </div>
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
              <Button
                aria-describedby={canSendTestEmail ? undefined : "smtp-test-email-hint"}
                disabled={pendingAction !== null || !canSendTestEmail}
                onClick={() => void run("email")}
                type="button"
                variant="outline"
              >
                <MailCheck />
                {pendingAction === "email" ? "Sending…" : "Send test email"}
              </Button>
            </div>
            {canSendTestEmail ? null : (
              <p className="text-xs text-muted-foreground" id="smtp-test-email-hint">
                {settings.smtpHost
                  ? "Save your changes first: the test email uses the saved settings."
                  : "Save SMTP settings first to send a test email."}
              </p>
            )}
          </div>

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

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            {isDirty ? (
              <p className="text-sm text-muted-foreground sm:mr-auto">You have unsaved changes.</p>
            ) : null}
            {isDirty ? (
              <Button
                disabled={pendingAction !== null}
                onClick={() => {
                  form.reset();
                  setError(null);
                  setTestResult(null);
                }}
                type="button"
                variant="ghost"
              >
                Discard changes
              </Button>
            ) : null}
            <Button disabled={pendingAction !== null} type="submit">
              <Save />
              {pendingAction === "save" ? "Saving…" : "Save SMTP settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
