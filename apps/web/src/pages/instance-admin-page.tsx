import { useCallback, useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { LoadingScreen } from "@/components/common/loading-screen";
import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orvalFetch } from "@/lib/orval-fetch";
import { GeneralTab } from "./instance-admin/general-tab";
import { SmtpTab } from "./instance-admin/smtp-tab";
import { UsersTab } from "./instance-admin/users-tab";

export type InstanceSettings = {
  registrationsEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  smtpPasswordConfigured: boolean;
};
export type InstanceUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  isSuperAdmin: boolean;
};
type UsersResponse = { items: InstanceUser[]; total: number; page: number; pageSize: number };

export function InstanceAdminPage() {
  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [users, setUsers] = useState<InstanceUser[]>([]);
  const [usersMeta, setUsersMeta] = useState({ total: 0, page: 1, pageSize: 20 });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const loadUsers = useCallback(async (search = "", page = 1) => {
    const r = await orvalFetch<{ data: UsersResponse }>("/instance-admin/users", {
      method: "GET",
      params: { search, page },
    });
    setUsers(r.data.items);
    setUsersMeta(r.data);
  }, []);
  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setMessage("");
      try {
        const [s] = await Promise.all([
          orvalFetch<{ data: InstanceSettings }>("/instance-admin/settings", { method: "GET" }),
          loadUsers(),
        ]);
        setSettings(s.data);
      } catch (error) {
        console.error(error);
        setMessage("Instance administrator access is required.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadUsers]);
  if (isLoading) {
    return <LoadingScreen compact label="Loading instance administration..." />;
  }
  if (!settings) {
    return <div className="text-sm text-muted-foreground">{message || "No instance data."}</div>;
  }
  const save = async (next: Partial<InstanceSettings> & { smtpPass?: string }) => {
    const r = await orvalFetch<{ data: InstanceSettings }>("/instance-admin/settings", {
      method: "PATCH",
      body: JSON.stringify(next),
    });
    setSettings(r.data);
    setMessage("Settings saved.");
  };
  const setRole = async (userId: string, isSuperAdmin: boolean) => {
    await orvalFetch(`/instance-admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ isSuperAdmin }),
    });
    await loadUsers("", usersMeta.page);
  };
  return (
    <div className="grid w-full gap-6">
      <PageHeader
        eyebrow="System"
        icon={Settings2}
        title="Instance administration"
        description="Control access, delivery, and instance operators."
      />
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      <Tabs defaultValue="general" className="grid gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="email">Email delivery</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <GeneralTab settings={settings} onSave={save} />
        </TabsContent>
        <TabsContent value="email">
          <SmtpTab settings={settings} onSave={save} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab
            users={users}
            total={usersMeta.total}
            page={usersMeta.page}
            pageSize={usersMeta.pageSize}
            onSearch={loadUsers}
            onChangeRole={setRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
