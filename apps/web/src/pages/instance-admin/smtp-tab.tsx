import { useState } from "react";
import { Save } from "lucide-react";
import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
        <Button
          className="w-fit"
          onClick={() => void onSave({ ...value, smtpPass: pass || undefined })}
        >
          <Save className="size-4" />
          Save SMTP settings
        </Button>
      </CardContent>
    </Card>
  );
}
