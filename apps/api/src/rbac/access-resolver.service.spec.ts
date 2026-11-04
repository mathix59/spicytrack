import { AccessResolver, PROJECT_PERMISSIONS } from "./access-resolver.service";

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

describe("AccessResolver.grantedProjectPermissions", () => {
  it("lists only project permissions", () => {
    expect(PROJECT_PERMISSIONS.length).toBeGreaterThan(0);
    expect(PROJECT_PERMISSIONS.every((permission) => permission.startsWith("project."))).toBe(true);
  });

  it("returns a system role's project permissions", async () => {
    const resolver = new AccessResolver(createDatabase() as never);

    const granted = await resolver.grantedProjectPermissions({
      organizationId: "org-1",
      role: "developer",
      userId: "user-1",
      teamId: null,
    });

    expect(granted).toContain("project.autofix.run");
    expect(granted).not.toContain("project.issues.manage");
  });

  it("adds the permissions granted by the project's team role", async () => {
    const resolver = new AccessResolver(
      createDatabase(
        [{ permissions: [] }],
        [{ permissions: ["view_projects", "manage_issues"] }],
      ) as never,
    );

    const granted = await resolver.grantedProjectPermissions({
      organizationId: "org-1",
      role: "custom",
      userId: "user-1",
      teamId: "team-1",
    });

    expect(granted).toContain("project.issues.read");
    expect(granted).toContain("project.issues.manage");
    expect(granted).not.toContain("project.autofix.run");
  });

  it("narrows the permissions to a read-only token's scope", async () => {
    const resolver = new AccessResolver(createDatabase() as never);

    const granted = await resolver.grantedProjectPermissions(
      { organizationId: "org-1", role: "owner", userId: "user-1", teamId: null },
      ["read"],
    );

    expect(granted).toContain("project.issues.read");
    expect(granted).not.toContain("project.issues.manage");
  });
});
