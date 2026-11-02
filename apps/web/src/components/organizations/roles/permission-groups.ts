import { TEAM_PERMISSIONS } from "@/components/organizations/team-card/constants";

type PermissionOption = { value: string; label: string };
type PermissionGroup = { id: string; label: string; permissions: PermissionOption[] };

function humanize(value: string) {
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "org.members.update_role" -> "Update role" (the group heading carries the resource). */
function organizationPermissionLabel(permission: string) {
  return humanize(permission.split(".").at(-1) ?? permission);
}

function organizationGroup(id: string, label: string, permissions: string[]): PermissionGroup {
  return {
    id,
    label,
    permissions: permissions.map((value) => ({ value, label: organizationPermissionLabel(value) })),
  };
}

const ORGANIZATION_PERMISSION_GROUPS: PermissionGroup[] = [
  organizationGroup("organization", "Organization", [
    "org.read",
    "org.settings.manage",
    "org.mcp.manage",
    "audit.read",
  ]),
  organizationGroup("members", "Members", [
    "org.members.read",
    "org.members.invite",
    "org.members.update_role",
    "org.members.remove",
  ]),
  organizationGroup("teams", "Teams", [
    "org.teams.read",
    "org.teams.create",
    "org.teams.update",
    "org.teams.delete",
  ]),
  organizationGroup("projects", "Projects", [
    "org.projects.read",
    "org.projects.create",
    "org.projects.update",
    "project.read",
  ]),
  organizationGroup("issues", "Issues & events", [
    "project.issues.read",
    "project.issues.manage",
    "project.events.read",
  ]),
  organizationGroup("releases", "Releases & artifacts", [
    "project.releases.read",
    "project.releases.manage",
    "project.artifacts.read",
    "project.artifacts.manage",
  ]),
  organizationGroup("alerts-keys", "Alerts & keys", [
    "project.alerts.read",
    "project.alerts.manage",
    "project.keys.read",
    "project.keys.manage",
  ]),
  organizationGroup("integrations", "Integrations & Autofix", [
    "project.integrations.read",
    "project.integrations.manage",
    "project.autofix.read",
    "project.autofix.run",
    "project.autofix.manage",
  ]),
];

const TEAM_PERMISSION_GROUP_DEFINITIONS: { id: string; label: string; permissions: string[] }[] = [
  { id: "projects", label: "Projects", permissions: ["view_projects", "view_audit"] },
  {
    id: "triage",
    label: "Triage & delivery",
    permissions: ["manage_issues", "manage_releases", "manage_alerts"],
  },
  {
    id: "configuration",
    label: "Configuration",
    permissions: ["manage_keys", "manage_integrations", "manage_autofix"],
  },
  { id: "team", label: "Team", permissions: ["manage_team"] },
];

const groupedTeamPermissions = new Set(
  TEAM_PERMISSION_GROUP_DEFINITIONS.flatMap((group) => group.permissions),
);

const TEAM_PERMISSION_GROUPS: PermissionGroup[] = [
  ...TEAM_PERMISSION_GROUP_DEFINITIONS,
  // Keep any permission added to TEAM_PERMISSIONS later visible even before it gets a group.
  {
    id: "other",
    label: "Other",
    permissions: TEAM_PERMISSIONS.filter((permission) => !groupedTeamPermissions.has(permission)),
  },
]
  .filter((group) => group.permissions.length > 0)
  .map((group) => ({
    ...group,
    permissions: group.permissions.map((value) => ({ value, label: humanize(value) })),
  }));

export { ORGANIZATION_PERMISSION_GROUPS, TEAM_PERMISSION_GROUPS };
export type { PermissionGroup, PermissionOption };
