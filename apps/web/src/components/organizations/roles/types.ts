/** What the role screens need from an organization or team role. */
type RoleItem = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  memberCount: number;
  pendingInvitationCount?: number;
};

type RoleMember = { id: string; name: string; email: string };

type RoleFormValues = { name: string; description: string | null; permissions: string[] };

export type { RoleFormValues, RoleItem, RoleMember };
