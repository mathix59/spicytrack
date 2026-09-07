import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";
import type { InstanceSettings } from "../instance-admin-page";
export function SmtpTab({
  settings,
  onSave,
}: {
  settings: InstanceSettings;
  onSave: (v: Partial<InstanceSettings> & { smtpPass?: string }) => Promise<void>;
}) {
  const [value, setValue] = useState(settings);
  const [pass, setPass] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue(settings), [settings]);
  const save = async () => {
    setPending(true);
    setError(null);
    try {
      const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpFrom } = value;
      await onSave({
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpFrom,
        smtpPass: pass || undefined,
      });
      setPass("");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setPending(false);
    }
  };
  return (
    <Card className="overflow-hidden">
      <OrganizationSectionHeader title="SMTP delivery" />
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="Host">
            <Input
              value={value.smtpHost ?? ""}
              onChange={(e) => setValue({ ...value, smtpHost: e.target.value || null })}
            />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              value={value.smtpPort ?? ""}
              onChange={(e) =>
                setValue({ ...value, smtpPort: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
        </div>
        <Field label="Connection security">
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
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
          </select>
        </Field>
        <Field label="Username">
          <Input
            value={value.smtpUser ?? ""}
            onChange={(e) => setValue({ ...value, smtpUser: e.target.value || null })}
          />
        </Field>
        <Field label={value.smtpPasswordConfigured ? "Password (leave blank to keep)" : "Password"}>
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </Field>
        <Field label="From address">
          <Input
            value={value.smtpFrom ?? ""}
            onChange={(e) => setValue({ ...value, smtpFrom: e.target.value || null })}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button className="w-fit" disabled={pending} onClick={() => void save()}>
          <Save className="size-4" />
          Save SMTP settings
        </Button>
      </CardContent>
    </Card>
  );
}
