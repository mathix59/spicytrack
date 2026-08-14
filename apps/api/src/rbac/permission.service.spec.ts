import { ForbiddenException } from "@nestjs/common";
import { PermissionService } from "./permission.service";
import { ROLE_PERMISSIONS } from "./permissions.constants";
import type { OrganizationRole, Permission } from "./permissions.types";

const ALL_PERMISSIONS = [...ROLE_PERMISSIONS.owner];
const ROLE_PERMISSION_CASES = (
  Object.entries(ROLE_PERMISSIONS) as [OrganizationRole, Permission[]][]
).flatMap(([role, granted]) =>
  ALL_PERMISSIONS.map((permission) => ({
    role,
    permission,
    expected: granted.includes(permission),
  })),
);
const GRANTED_CASES = ROLE_PERMISSION_CASES.filter(({ expected }) => expected);
const DENIED_CASES = ROLE_PERMISSION_CASES.filter(({ expected }) => !expected);

describe("PermissionService role matrix", () => {
  const service = new PermissionService();

  it.each(GRANTED_CASES)("grants $role / $permission", ({ role, permission }) => {
    expect(service.hasPermission(role, permission)).toBe(true);
    expect(() => service.assertPermission(role, permission)).not.toThrow();
  });

  it.each(DENIED_CASES)("denies $role / $permission", ({ role, permission }) => {
    expect(service.hasPermission(role, permission)).toBe(false);
    expect(() => service.assertPermission(role, permission)).toThrow(ForbiddenException);
  });

  it("denies unknown roles by default", () => {
    expect(service.hasPermission("unknown", "org.read")).toBe(false);
    expect(() => service.assertPermission("unknown", "org.read")).toThrow(ForbiddenException);
  });

  it("keeps role permission lists free of duplicates", () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });
});
