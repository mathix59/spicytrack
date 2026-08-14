import { ForbiddenException } from "@nestjs/common";
import {
  assertRoleManageable,
  assertRolePermissionsAssignable,
  type RolePolicyRecord,
} from "./organization-role-policy";
import { ROLE_PERMISSIONS } from "./permissions.constants";

const owner: RolePolicyRecord = { key: "owner", permissions: ["org.read"] };
const admin: RolePolicyRecord = {
  key: "admin",
  permissions: ["org.read", "org.members.read", "org.members.update_role"],
};
const manager: RolePolicyRecord = {
  key: "manager",
  permissions: ["org.read", "org.members.read"],
};
const custom: RolePolicyRecord = { key: "custom", permissions: ["org.read"] };

describe("organization role policy", () => {
  it("keeps the system role hierarchy strictly descending below admin", () => {
    const expectStrictSubset = (lower: readonly string[], higher: readonly string[]) => {
      expect(lower.every((permission) => higher.includes(permission))).toBe(true);
      expect(lower.length).toBeLessThan(higher.length);
    };

    expect(ROLE_PERMISSIONS.owner).toEqual(ROLE_PERMISSIONS.admin);
    expectStrictSubset(ROLE_PERMISSIONS.manager, ROLE_PERMISSIONS.admin);
    expectStrictSubset(ROLE_PERMISSIONS.developer, ROLE_PERMISSIONS.manager);
    expectStrictSubset(ROLE_PERMISSIONS.member, ROLE_PERMISSIONS.manager);
    expectStrictSubset(ROLE_PERMISSIONS.viewer, ROLE_PERMISSIONS.member);
  });

  it("never grants a project management capability without its read capability", () => {
    const requirements = [
      ["project.issues.manage", "project.issues.read"],
      ["project.releases.manage", "project.releases.read"],
      ["project.artifacts.manage", "project.artifacts.read"],
      ["project.alerts.manage", "project.alerts.read"],
      ["project.keys.manage", "project.keys.read"],
      ["project.integrations.manage", "project.integrations.read"],
      ["project.autofix.run", "project.autofix.read"],
      ["project.autofix.manage", "project.autofix.read"],
    ] as const;

    const violations: Array<{ capability: string; requiredRead: string }> = [];
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const [capability, requiredRead] of requirements) {
        if (permissions.includes(capability) && !permissions.includes(requiredRead)) {
          violations.push({ capability, requiredRead });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("allows owners to assign and manage every role", () => {
    expect(() => assertRolePermissionsAssignable(owner, admin)).not.toThrow();
    expect(() => assertRoleManageable(owner, owner)).not.toThrow();
  });

  it("allows non-owners to assign and manage only strictly lower roles", () => {
    expect(() => assertRolePermissionsAssignable(admin, manager)).not.toThrow();
    expect(() => assertRoleManageable(admin, manager)).not.toThrow();
  });

  it.each([
    ["assign owner", () => assertRolePermissionsAssignable(admin, owner)],
    ["assign equal", () => assertRolePermissionsAssignable(admin, { ...admin, key: "peer" })],
    ["assign elevated", () => assertRolePermissionsAssignable(manager, admin)],
    ["manage owner", () => assertRoleManageable(admin, owner)],
    ["manage equal", () => assertRoleManageable(admin, { ...admin, key: "peer" })],
    ["manage incomparable", () => assertRoleManageable(custom, manager)],
  ])("rejects a non-owner attempting to %s", (_label, action) => {
    expect(action).toThrow(ForbiddenException);
  });
});
