import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { InstanceSettings } from "../instance-admin-page";

export function GeneralTab({
  settings,
  onSave,
}: {
  settings: InstanceSettings;
  onSave: (v: Partial<InstanceSettings>) => Promise<void>;
}) {
  const open = settings.registrationsEnabled;
  return (
    <Card className="overflow-hidden">
      <OrganizationSectionHeader
        title="Registration access"
        action={
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${open ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
          >
            {open ? "Open" : "Closed"}
          </span>
        }
      />
      <CardContent>
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="font-medium">Public registration</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {open
                ? "Visitors can create an account from the sign-in page."
                : "Only existing users can sign in. You can reopen registration at any time."}
            </p>
          </div>
          <Switch
            aria-label="Allow new registrations"
            checked={open}
            onCheckedChange={(registrationsEnabled) => void onSave({ registrationsEnabled })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
