import { ForbiddenException } from "@nestjs/common";
import type { Permission } from "./permissions.types";

export type RolePolicyRecord = {
  key: string;
  permissions: readonly Permission[];
};

function isPermissionSubset(candidate: readonly Permission[], allowed: readonly Permission[]) {
  const allowedPermissions = new Set(allowed);
  return candidate.every((permission) => allowedPermissions.has(permission));
}

export function assertRolePermissionsAssignable(
  actor: RolePolicyRecord,
  desired: RolePolicyRecord,
) {
  if (actor.key === "owner") return;
  if (
    desired.key === "owner" ||
    !isPermissionSubset(desired.permissions, actor.permissions) ||
    isPermissionSubset(actor.permissions, desired.permissions)
  ) {
    throw new ForbiddenException("You cannot assign a role equal to or above your own");
  }
}

export function assertRoleManageable(actor: RolePolicyRecord, target: RolePolicyRecord) {
  if (actor.key === "owner") return;
  if (
    target.key === "owner" ||
    !isPermissionSubset(target.permissions, actor.permissions) ||
    isPermissionSubset(actor.permissions, target.permissions)
  ) {
    throw new ForbiddenException("You cannot manage a role equal to or above your own");
  }
}
