import { toast } from "sonner";

import { OrganizationSectionHeader } from "@/components/organizations/organization-section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/utils";

import type { InstanceSettings, InstanceSettingsUpdate } from "./types";

export function GeneralTab({
  settings,
  isSaving,
  onSave,
}: {
  settings: InstanceSettings;
  isSaving: boolean;
  onSave: (next: InstanceSettingsUpdate) => Promise<unknown>;
}) {
  const open = settings.registrationsEnabled;

  const toggle = async (registrationsEnabled: boolean) => {
    try {
      await onSave({ registrationsEnabled });
    } catch (error) {
      toast.error("Could not update registration access", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <Card className="overflow-hidden">
      <OrganizationSectionHeader
        action={<Badge variant={open ? "success" : "muted"}>{open ? "Open" : "Closed"}</Badge>}
        description="Decide whether anyone can create an account on this instance."
        title="Registration access"
      />
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:items-center">
          <div className="min-w-0">
            <p className="font-medium">Public registration</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {open
                ? "Visitors can create an account from the sign-in page."
                : "Existing users can sign in and invited users can create an account. You can reopen public registration at any time."}
            </p>
          </div>
          <Switch
            aria-label="Allow new registrations"
            checked={open}
            disabled={isSaving}
            onCheckedChange={(registrationsEnabled) => void toggle(registrationsEnabled)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
