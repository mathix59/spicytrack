import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE, primaryDatabase } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { organizationRoles, teamMembers, teamRoles } from "../database/schema";
import { ROLE_PERMISSIONS } from "./permissions.constants";
import type { Permission } from "./permissions.types";

export type AccessSubject = {
  organizationId: string;
  /** Organization membership role: a system role or a custom role key. */
  role: string;
  userId?: string | null;
  /** Team owning the project, whose team roles can grant project permissions. */
  teamId?: string | null;
};

/** What a member may do: organization role first, then their role in the project's team. */
@Injectable()
export class AccessResolver {
  private readonly db: DatabaseClient;

  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.db = primaryDatabase(database);
  }

  /** The permissions among `required` that the subject lacks. */
  async missingPermissions(subject: AccessSubject, required: Permission[]): Promise<Permission[]> {
    if (required.length === 0) return [];
    const systemPermissions = ROLE_PERMISSIONS[subject.role as keyof typeof ROLE_PERMISSIONS];
    const [organizationRole] = systemPermissions
      ? [{ permissions: systemPermissions }]
      : await this.db
          .select({ permissions: organizationRoles.permissions })
          .from(organizationRoles)
          .where(
            and(
              eq(organizationRoles.organizationId, subject.organizationId),
              eq(organizationRoles.key, subject.role),
            ),
          )
          .limit(1);
    const organizationPermissions = new Set(
      (organizationRole?.permissions as string[] | undefined) ?? [],
    );
    const missing = required.filter((permission) => !organizationPermissions.has(permission));
    if (missing.length === 0 || !subject.teamId || !subject.userId) return missing;

    const [teamMember] = await this.db
      .select({ permissions: teamRoles.permissions })
      .from(teamMembers)
      .innerJoin(
        teamRoles,
        and(eq(teamRoles.teamId, teamMembers.teamId), eq(teamRoles.key, teamMembers.role)),
      )
      .where(and(eq(teamMembers.teamId, subject.teamId), eq(teamMembers.userId, subject.userId)))
      .limit(1);
    const teamPermissions = new Set((teamMember?.permissions as string[] | undefined) ?? []);
    return missing.filter((permission) => {
      const teamPermission = PROJECT_TEAM_PERMISSION[permission];
      return !teamPermission || !teamPermissions.has(teamPermission);
    });
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
