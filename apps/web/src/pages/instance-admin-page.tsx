import { Settings2 } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AuditTab } from "./instance-admin/audit-tab";
import { GeneralTab } from "./instance-admin/general-tab";
import { SmtpTab } from "./instance-admin/smtp-tab";
import { useInstanceSettings } from "./instance-admin/use-instance-settings";
import { UsersTab } from "./instance-admin/users-tab";

export function InstanceAdminPage() {
  const { settingsQuery, isForbidden, isSaving, save } = useInstanceSettings();
  const settings = settingsQuery.data;

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
        <Tabs defaultValue="general" className="grid gap-4">
          <TabsList variant="underline">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="email">Email delivery</TabsTrigger>
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
            {settings ? <SmtpTab onSave={save} settings={settings} /> : settingsFallback}
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
