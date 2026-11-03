import { AccessResolver } from "./access-resolver.service";
import { PermissionGuard } from "./permission.guard";
// Explicit boundary cases; the full independent policy is checked by PermissionService.
const GRANTED_ROLE_CASES = [
  { role: "owner", permission: "org.settings.manage" },
  { role: "admin", permission: "org.mcp.manage" },
  { role: "manager", permission: "project.keys.manage" },
  { role: "developer", permission: "project.autofix.run" },
  { role: "member", permission: "org.members.read" },
  { role: "viewer", permission: "project.read" },
];
const DENIED_ROLE_CASES = [
  { role: "manager", permission: "org.settings.manage" },
  { role: "developer", permission: "org.members.read" },
  { role: "member", permission: "project.autofix.run" },
  { role: "viewer", permission: "project.keys.manage" },
];

function createDatabase(...rows: unknown[][]) {
  const where = jest.fn(() => ({
    limit: jest.fn(async () => rows.shift() ?? []),
  }));
  return {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where,
        innerJoin: jest.fn(() => ({ where })),
      })),
    })),
  };
}

function createContext(input: {
  organizationRole?: string;
  project?: { teamId: string | null };
  withoutMembership?: boolean;
}) {
  const request = {
    auth: { user: { id: "user-1" } },
    organization: {
      organization: { id: "org-1" },
      membership: input.withoutMembership
        ? undefined
        : { role: input.organizationRole ?? "custom" },
    },
    project: input.project,
  };
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe("PermissionGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("allows routes that do not declare permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const db = createDatabase();
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("rejects a permission-protected route without an organization membership", async () => {
    reflector.getAllAndOverride.mockReturnValue(["org.read"]);
    const guard = new PermissionGuard(
      reflector as never,
      new AccessResolver(createDatabase() as never),
    );

    await expect(guard.canActivate(createContext({ withoutMembership: true }))).resolves.toBe(
      false,
    );
  });

  it("uses the code-defined permissions for system roles instead of stale database rows", async () => {
    reflector.getAllAndOverride.mockReturnValue(["project.read"]);
    const db = createDatabase([{ permissions: [] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(
      guard.canActivate(
        createContext({ organizationRole: "viewer", project: { teamId: "team-1" } }),
      ),
    ).resolves.toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each(GRANTED_ROLE_CASES)(
    "allows $role when an endpoint requires $permission",
    async ({ role, permission }) => {
      reflector.getAllAndOverride.mockReturnValue([permission]);
      const db = createDatabase();
      const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

      await expect(guard.canActivate(createContext({ organizationRole: role }))).resolves.toBe(
        true,
      );
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it.each(DENIED_ROLE_CASES)(
    "denies $role when an endpoint requires $permission",
    async ({ role, permission }) => {
      reflector.getAllAndOverride.mockReturnValue([permission]);
      const db = createDatabase();
      const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

      await expect(guard.canActivate(createContext({ organizationRole: role }))).rejects.toThrow(
        "Missing permission",
      );
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it("grants a custom organization role its direct permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(["org.members.invite"]);
    const db = createDatabase([{ permissions: ["org.members.invite"] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
  });

  it("grants organization-wide project permissions without a team membership", async () => {
    reflector.getAllAndOverride.mockReturnValue(["project.keys.manage"]);
    const db = createDatabase([{ permissions: ["project.keys.manage"] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(
      guard.canActivate(
        createContext({
          project: { teamId: "team-1" },
        }),
      ),
    ).resolves.toBe(true);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["project.issues.manage", "manage_issues"],
    ["project.releases.manage", "manage_releases"],
    ["project.artifacts.manage", "manage_releases"],
    ["project.alerts.manage", "manage_alerts"],
    ["project.keys.manage", "manage_keys"],
    ["project.integrations.manage", "manage_integrations"],
    ["project.autofix.run", "manage_autofix"],
    ["project.autofix.manage", "manage_autofix"],
    ["audit.read", "view_audit"],
  ] as const)("grants %s from the %s team permission", async (permission, teamPermission) => {
    reflector.getAllAndOverride.mockReturnValue([permission]);
    const db = createDatabase([{ permissions: [] }], [{ permissions: [teamPermission] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(guard.canActivate(createContext({ project: { teamId: "team-1" } }))).resolves.toBe(
      true,
    );
  });

  it.each([
    "project.read",
    "project.issues.read",
    "project.events.read",
    "project.releases.read",
    "project.artifacts.read",
    "project.alerts.read",
    "project.keys.read",
    "project.integrations.read",
    "project.autofix.read",
  ] as const)("grants %s from a team view permission", async (permission) => {
    reflector.getAllAndOverride.mockReturnValue([permission]);
    const db = createDatabase([{ permissions: [] }], [{ permissions: ["view_projects"] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(guard.canActivate(createContext({ project: { teamId: "team-1" } }))).resolves.toBe(
      true,
    );
  });

  it("does not use a team role for organization-scoped permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(["org.members.read"]);
    const db = createDatabase([{ permissions: [] }], [{ permissions: ["manage_team"] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(
      guard.canActivate(createContext({ project: { teamId: "team-1" } })),
    ).rejects.toThrow("Missing permission");
  });

  it("rejects a missing permission on an unassigned project", async () => {
    reflector.getAllAndOverride.mockReturnValue(["project.keys.manage"]);
    const db = createDatabase([{ permissions: [] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(guard.canActivate(createContext({ project: { teamId: null } }))).rejects.toThrow(
      "Missing permission",
    );
  });

  it("rejects a custom role when neither its organization nor team role grants the permission", async () => {
    reflector.getAllAndOverride.mockReturnValue(["project.integrations.manage"]);
    const db = createDatabase([{ permissions: [] }], [{ permissions: ["view_projects"] }]);
    const guard = new PermissionGuard(reflector as never, new AccessResolver(db as never));

    await expect(
      guard.canActivate(createContext({ project: { teamId: "team-1" } })),
    ).rejects.toThrow("Missing permission");
  });
});
