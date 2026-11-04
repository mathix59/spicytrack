import { TEAM_PERMISSIONS } from "@/components/organizations/team-card/constants";

import {
  ORGANIZATION_PERMISSION_COPY,
  type PermissionCopy,
  type PermissionOption,
  TEAM_PERMISSION_COPY,
} from "./permission-copy";

type PermissionGroup = { id: string; label: string; permissions: PermissionOption[] };

function humanize(value: string) {
  const text = value.replaceAll("_", " ").replaceAll(".", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildGroups(
  definitions: { id: string; label: string; permissions: string[] }[],
  copy: Record<string, PermissionCopy>,
): PermissionGroup[] {
  return definitions
    .filter((group) => group.permissions.length > 0)
    .map((group) => ({
      ...group,
      permissions: group.permissions.map((value) => ({
        value,
        ...(copy[value] ?? { label: humanize(value), description: value }),
      })),
    }));
}

const ORGANIZATION_PERMISSION_GROUPS = buildGroups(
  [
    {
      id: "organization",
      label: "Organization",
      permissions: ["org.read", "org.settings.manage", "org.mcp.manage", "audit.read"],
    },
    {
      id: "members",
      label: "Members",
      permissions: [
        "org.members.read",
        "org.members.invite",
        "org.members.update_role",
        "org.members.remove",
      ],
    },
    {
      id: "teams",
      label: "Teams",
      permissions: ["org.teams.read", "org.teams.create", "org.teams.update", "org.teams.delete"],
    },
    {
      id: "projects",
      label: "Projects",
      permissions: [
        "org.projects.read",
        "org.projects.create",
        "org.projects.update",
        "project.read",
      ],
    },
    {
      id: "issues",
      label: "Issues & events",
      permissions: ["project.issues.read", "project.issues.manage", "project.events.read"],
    },
    {
      id: "releases",
      label: "Releases & artifacts",
      permissions: [
        "project.releases.read",
        "project.releases.manage",
        "project.artifacts.read",
        "project.artifacts.manage",
      ],
    },
    {
      id: "alerts-keys",
      label: "Alerts & keys",
      permissions: [
        "project.alerts.read",
        "project.alerts.manage",
        "project.keys.read",
        "project.keys.manage",
      ],
    },
    {
      id: "integrations",
      label: "Integrations & Autofix",
      permissions: [
        "project.integrations.read",
        "project.integrations.manage",
        "project.autofix.read",
        "project.autofix.run",
        "project.autofix.manage",
      ],
    },
  ],
  ORGANIZATION_PERMISSION_COPY,
);

const TEAM_PERMISSION_GROUP_DEFINITIONS = [
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

const TEAM_PERMISSION_GROUPS = buildGroups(
  [
    ...TEAM_PERMISSION_GROUP_DEFINITIONS,
    // Keep any permission added to TEAM_PERMISSIONS later visible even before it gets a group.
    {
      id: "other",
      label: "Other",
      permissions: TEAM_PERMISSIONS.filter((permission) => !groupedTeamPermissions.has(permission)),
    },
  ],
  TEAM_PERMISSION_COPY,
);

function permissionIndex(groups: PermissionGroup[]) {
  return new Map(
    groups.flatMap((group) =>
      group.permissions.map((permission) => [permission.value, permission]),
    ),
  );
}

export { ORGANIZATION_PERMISSION_GROUPS, TEAM_PERMISSION_GROUPS, permissionIndex };
export type { PermissionGroup, PermissionOption };
