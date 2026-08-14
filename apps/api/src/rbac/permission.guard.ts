import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq } from "drizzle-orm";
import { AuthenticatedRequest } from "../common/authenticated-request";
import { DATABASE, primaryDatabase } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { organizationRoles, teamMembers, teamRoles } from "../database/schema";
import { PermissionService } from "./permission.service";
import { ROLE_PERMISSIONS } from "./permissions.constants";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";
import { Permission } from "./permissions.types";

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly db: DatabaseClient;

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
    @Inject(DATABASE) database: DatabaseClient,
  ) {
    this.db = primaryDatabase(database);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const membership = request.organization?.membership;

    if (!membership) {
      return false;
    }

    const systemPermissions = ROLE_PERMISSIONS[membership.role as keyof typeof ROLE_PERMISSIONS];
    const [organizationRole] = systemPermissions
      ? [{ permissions: systemPermissions }]
      : await this.db
          .select({ permissions: organizationRoles.permissions })
          .from(organizationRoles)
          .where(
            and(
              eq(organizationRoles.organizationId, request.organization!.organization.id),
              eq(organizationRoles.key, membership.role),
            ),
          )
          .limit(1);
    const organizationPermissions = new Set(
      (organizationRole?.permissions as string[] | undefined) ?? [],
    );
    const missingPermissions = requiredPermissions.filter(
      (permission) => !organizationPermissions.has(permission),
    );
    if (missingPermissions.length === 0) {
      return true;
    }

    const project = request.project;
    const userId = request.auth?.user.id;
    if (!project?.teamId || !userId) {
      if (missingPermissions.length)
        this.permissionService.assertPermission(membership.role, missingPermissions[0]);
      return true;
    }

    const [teamMember] = await this.db
      .select({ permissions: teamRoles.permissions })
      .from(teamMembers)
      .innerJoin(
        teamRoles,
        and(eq(teamRoles.teamId, teamMembers.teamId), eq(teamRoles.key, teamMembers.role)),
      )
      .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)))
      .limit(1);
    const teamPermissions = new Set((teamMember?.permissions as string[] | undefined) ?? []);

    for (const permission of missingPermissions) {
      const teamPermission = PROJECT_TEAM_PERMISSION[permission];
      if (!teamPermission || !teamPermissions.has(teamPermission)) {
        this.permissionService.assertPermission(membership.role, permission);
      }
    }

    return true;
  }
}

export const PROJECT_TEAM_PERMISSION: Partial<Record<Permission, string>> = {
  "project.read": "view_projects",
  "project.issues.read": "view_projects",
  "project.events.read": "view_projects",
  "project.releases.read": "view_projects",
  "project.artifacts.read": "view_projects",
  "project.alerts.read": "view_projects",
  "project.keys.read": "view_projects",
  "project.integrations.read": "view_projects",
  "project.autofix.read": "view_projects",
  "project.issues.manage": "manage_issues",
  "project.releases.manage": "manage_releases",
  "project.artifacts.manage": "manage_releases",
  "project.alerts.manage": "manage_alerts",
  "project.keys.manage": "manage_keys",
  "project.integrations.manage": "manage_integrations",
  "project.autofix.run": "manage_autofix",
  "project.autofix.manage": "manage_autofix",
  "audit.read": "view_audit",
};
