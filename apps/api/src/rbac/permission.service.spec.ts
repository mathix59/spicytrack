import { ForbiddenException } from "@nestjs/common";
import { PermissionService } from "./permission.service";
import type { OrganizationRole, Permission } from "./permissions.types";

// Policy expectations are independent from ROLE_PERMISSIONS, the implementation under test.
const everyone: OrganizationRole[] = ["owner", "admin", "manager", "developer", "member", "viewer"];
const operators: OrganizationRole[] = ["owner", "admin", "manager"];
const administrators: OrganizationRole[] = ["owner", "admin"];
const policy = {
  "org.read": everyone,
  "org.members.read": [...operators, "member"],
  "org.members.invite": operators,
  "org.members.update_role": operators,
  "org.members.remove": operators,
  "org.teams.read": everyone,
  "org.teams.create": operators,
  "org.teams.update": operators,
  "org.teams.delete": administrators,
  "org.projects.read": everyone,
  "org.projects.create": operators,
  "org.projects.update": operators,
  "project.read": everyone,
  "project.issues.read": everyone,
  "project.issues.manage": operators,
  "project.events.read": everyone,
  "project.releases.read": everyone,
  "project.releases.manage": operators,
  "project.artifacts.read": everyone,
  "project.artifacts.manage": operators,
  "project.alerts.read": operators,
  "project.alerts.manage": operators,
  "project.keys.read": operators,
  "project.keys.manage": operators,
  "project.integrations.read": everyone,
  "project.integrations.manage": operators,
  "project.autofix.read": everyone,
  "project.autofix.run": [...operators, "developer"],
  "project.autofix.manage": operators,
  "org.settings.manage": administrators,
  "org.mcp.manage": administrators,
  "audit.read": operators,
} satisfies Record<Permission, OrganizationRole[]>;

describe("PermissionService authorization policy", () => {
  const service = new PermissionService();

  it.each(everyone)("enforces every permission for %s", (role) => {
    for (const [permission, allowedRoles] of Object.entries(policy)) {
      const allowed = allowedRoles.includes(role);
      expect({
        role,
        permission,
        allowed: service.hasPermission(role, permission as Permission),
      }).toEqual({ role, permission, allowed });
      let error: unknown;
      try {
        service.assertPermission(role, permission as Permission);
      } catch (thrown) {
        error = thrown;
      }
      expect({ permission, denied: error instanceof ForbiddenException }).toEqual({
        permission,
        denied: !allowed,
      });
    }
  });

  it("denies unknown roles by default", () => {
    expect(service.hasPermission("unknown", "org.read")).toBe(false);
    expect(() => service.assertPermission("unknown", "org.read")).toThrow(ForbiddenException);
  });
});
