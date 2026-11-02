type InstanceSettings = {
  registrationsEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  smtpPasswordConfigured: boolean;
};

type InstanceSettingsUpdate = Partial<InstanceSettings> & { smtpPass?: string };

type InstanceUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  isSuperAdmin: boolean;
};

type InstanceUsersPage = { items: InstanceUser[]; total: number; page: number; pageSize: number };

export type { InstanceSettings, InstanceSettingsUpdate, InstanceUser, InstanceUsersPage };
