import { TEAM_PERMISSIONS } from "@/components/organizations/team-card/constants";

type PermissionOption = {
  value: string;
  label: string;
  description: string;
  /** Grants control over people, credentials or the organization itself. */
  sensitive?: boolean;
};
type PermissionGroup = { id: string; label: string; permissions: PermissionOption[] };

type PermissionCopy = Omit<PermissionOption, "value">;

function humanize(value: string) {
  const text = value.replaceAll("_", " ").replaceAll(".", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ORGANIZATION_PERMISSION_COPY: Record<string, PermissionCopy> = {
  "org.read": { label: "View organization", description: "See the organization and its overview." },
  "org.settings.manage": {
    label: "Manage settings",
    description: "Change organization settings, the AI provider, the GitHub App and custom roles.",
    sensitive: true,
  },
  "org.mcp.manage": {
    label: "Manage MCP",
    description: "Enable MCP and create or revoke MCP credentials.",
    sensitive: true,
  },
  "audit.read": { label: "View audit log", description: "Read the organization audit log." },
  "org.members.read": {
    label: "View members",
    description: "See the member list and pending invitations.",
  },
  "org.members.invite": {
    label: "Invite members",
    description: "Invite people and resend or revoke pending invitations.",
  },
  "org.members.update_role": {
    label: "Change roles",
    description: "Change the organization role of other members.",
    sensitive: true,
  },
  "org.members.remove": {
    label: "Remove members",
    description: "Remove people from the organization.",
    sensitive: true,
  },
  "org.teams.read": { label: "View teams", description: "See teams and who belongs to them." },
  "org.teams.create": { label: "Create teams", description: "Create new teams." },
  "org.teams.update": {
    label: "Edit teams",
    description: "Rename teams, manage their members and their team roles.",
  },
  "org.teams.delete": {
    label: "Delete teams",
    description: "Delete teams and their team roles.",
    sensitive: true,
  },
  "org.projects.read": {
    label: "List projects",
    description: "See every project of the organization.",
  },
  "org.projects.create": { label: "Create projects", description: "Create new projects." },
  "org.projects.update": {
    label: "Edit projects",
    description: "Change project settings, visibility and processing rules.",
  },
  "project.read": { label: "Open projects", description: "Open projects and see their setup." },
  "project.issues.read": { label: "View issues", description: "See issues and their activity." },
  "project.issues.manage": {
    label: "Manage issues",
    description: "Resolve, ignore, assign, merge and comment on issues.",
  },
  "project.events.read": {
    label: "View events",
    description: "See events, stack traces and raw payloads.",
  },
  "project.releases.read": {
    label: "View releases",
    description: "See releases and environments.",
  },
  "project.releases.manage": { label: "Manage releases", description: "Create and edit releases." },
  "project.artifacts.read": {
    label: "View artifacts",
    description: "See uploaded source maps and other artifacts.",
  },
  "project.artifacts.manage": {
    label: "Manage artifacts",
    description: "Upload and delete source maps and other artifacts.",
  },
  "project.alerts.read": { label: "View alerts", description: "See alert rules and deliveries." },
  "project.alerts.manage": {
    label: "Manage alerts",
    description: "Create, edit, test and delete alert rules.",
  },
  "project.keys.read": { label: "View keys", description: "See client keys and DSNs." },
  "project.keys.manage": {
    label: "Manage keys",
    description: "Create, rotate and disable client keys.",
    sensitive: true,
  },
  "project.integrations.read": {
    label: "View integrations",
    description: "See connected repositories and issue trackers.",
  },
  "project.integrations.manage": {
    label: "Manage integrations",
    description: "Connect, configure and disconnect integrations.",
    sensitive: true,
  },
  "project.autofix.read": { label: "View Autofix", description: "See Autofix runs and AI triage." },
  "project.autofix.run": { label: "Run Autofix", description: "Start Autofix runs and AI triage." },
  "project.autofix.manage": {
    label: "Configure Autofix",
    description: "Change how Autofix works on each project.",
  },
};

const TEAM_PERMISSION_COPY: Record<string, PermissionCopy> = {
  view_projects: {
    label: "View projects",
    description: "Open the team's projects, their issues and events.",
  },
  view_audit: {
    label: "View audit log",
    description: "Read the audit log of the team's projects.",
  },
  manage_issues: {
    label: "Manage issues",
    description: "Resolve, ignore, assign and comment on issues.",
  },
  manage_releases: {
    label: "Manage releases",
    description: "Create releases and upload source maps.",
  },
  manage_alerts: { label: "Manage alerts", description: "Create, edit and delete alert rules." },
  manage_keys: {
    label: "Manage keys",
    description: "Create, rotate and disable client keys.",
    sensitive: true,
  },
  manage_integrations: {
    label: "Manage integrations",
    description: "Connect, configure and disconnect integrations.",
    sensitive: true,
  },
  manage_autofix: { label: "Manage Autofix", description: "Run and configure Autofix." },
  manage_team: {
    label: "Manage team",
    description: "Add and remove team members and change their team roles.",
    sensitive: true,
  },
};

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
