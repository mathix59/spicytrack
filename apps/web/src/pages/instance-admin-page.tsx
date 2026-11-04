import { Settings2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AuditTab } from "./instance-admin/audit-tab";
import { GeneralTab } from "./instance-admin/general-tab";
import { SmtpTab } from "./instance-admin/smtp-tab";
import { useInstanceSettings } from "./instance-admin/use-instance-settings";
import { useSmtpForm } from "./instance-admin/use-smtp-form";
import { UsersTab } from "./instance-admin/users-tab";

const ADMIN_TABS = ["general", "email", "users", "audit"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

function parseAdminTab(value: string | null): AdminTab {
  return ADMIN_TABS.find((tab) => tab === value) ?? "general";
}

export function InstanceAdminPage() {
  const { settingsQuery, isForbidden, isSaving, save } = useInstanceSettings();
  const settings = settingsQuery.data;
  // The draft lives here so switching tabs never drops unsaved SMTP edits.
  const smtpForm = useSmtpForm(settings);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseAdminTab(searchParams.get("tab"));

  const selectTab = (value: string) => {
    // Radix reports a mouse selection twice (mouse down, then focus) before re-rendering, so
    // compare with the live URL to push a single history entry.
    if (parseAdminTab(new URLSearchParams(window.location.search).get("tab")) === value) return;
    const next = new URLSearchParams(searchParams);
    if (value === "general") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next);
  };

  const settingsFallback = settingsQuery.isError ? (
    <QueryError
      error={isForbidden ? undefined : settingsQuery.error}
      onRetry={isForbidden ? undefined : () => void settingsQuery.refetch()}
      title={
        isForbidden
          ? "Instance administrator access is required."
          : "Could not load instance settings"
      }
    />
  ) : (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <Skeleton className="h-6 w-48" />
        <SkeletonRows rows={3} />
      </CardContent>
    </Card>
  );

  return (
    <div className="grid w-full gap-6">
      <PageHeader
        eyebrow="System"
        icon={Settings2}
        title="Instance administration"
        description="Control who can sign up, how email is delivered, and who operates this instance."
      />
      {isForbidden ? (
        settingsFallback
      ) : (
        <Tabs className="grid gap-4" onValueChange={selectTab} value={activeTab}>
          <TabsList aria-label="Instance administration sections" variant="underline">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="email">
              Email delivery
              {smtpForm.isDirty ? (
                <>
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                  <span className="sr-only">(unsaved changes)</span>
                </>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>
          <TabsContent className="mt-0" value="general">
            {settings ? (
              <GeneralTab isSaving={isSaving} onSave={save} settings={settings} />
            ) : (
              settingsFallback
            )}
          </TabsContent>
          <TabsContent className="mt-0" value="email">
            {settings ? (
              <SmtpTab form={smtpForm} onSave={save} settings={settings} />
            ) : (
              settingsFallback
            )}
          </TabsContent>
          <TabsContent className="mt-0" value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent className="mt-0" value="audit">
            <AuditTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
