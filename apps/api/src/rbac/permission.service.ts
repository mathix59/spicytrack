import { ForbiddenException, Injectable } from "@nestjs/common";
import { ROLE_PERMISSIONS } from "./permissions.constants";
import { OrganizationRole, Permission } from "./permissions.types";

@Injectable()
export class PermissionService {
  hasPermission(role: string, permission: Permission): boolean {
    const permissions = ROLE_PERMISSIONS[role as OrganizationRole] ?? [];
    return permissions.includes(permission);
  }

  assertPermission(role: string, permission: Permission) {
    if (!this.hasPermission(role, permission)) {
      throw new ForbiddenException(`Missing permission ${permission}`);
    }
  }
}
