import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  organizationMembers,
  projects,
  teamMembers,
  teamRoles,
  teams,
  users,
} from "../database/schema";

export const TEAM_PERMISSIONS = [
  "view_projects",
  "manage_issues",
  "manage_releases",
  "manage_alerts",
  "manage_keys",
  "manage_integrations",
  "manage_autofix",
  "view_audit",
  "manage_team",
] as const;

type TeamPermission = (typeof TEAM_PERMISSIONS)[number];

const DEFAULT_TEAM_ROLES: Array<{
  key: string;
  name: string;
  permissions: TeamPermission[];
}> = [
  { key: "viewer", name: "Viewer", permissions: ["view_projects"] },
  {
    key: "contributor",
    name: "Contributor",
    permissions: ["view_projects", "manage_issues"],
  },
  {
    key: "maintainer",
    name: "Maintainer",
    permissions: [
      "view_projects",
      "manage_issues",
      "manage_releases",
      "manage_alerts",
      "manage_keys",
      "manage_integrations",
      "manage_autofix",
      "view_audit",
      "manage_team",
    ],
  },
];

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
  ) {}

  async list(organizationId: string) {
    return this.db.select().from(teams).where(eq(teams.organizationId, organizationId));
  }

  async create(input: {
    organizationId: string;
    name: string;
    slug: string;
    description?: string;
    actorUserId: string;
  }) {
    const existing = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.organizationId, input.organizationId), eq(teams.slug, input.slug)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException("Team slug already exists");
    }

    const [team] = await this.db
      .insert(teams)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description,
      })
      .returning();

    await this.createDefaultRoles(team.organizationId, team.id);

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.created",
      targetType: "team",
      targetId: team.id,
      payload: { slug: team.slug },
    });

    return team;
  }

  async listMembers(organizationId: string, teamSlug: string) {
    const team = await this.getBySlugWithRoles(organizationId, teamSlug);

    const members = await this.db
      .select({
        teamMemberId: teamMembers.id,
        role: teamMembers.role,
        userId: users.id,
        email: users.email,
        name: users.name,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, team.id));

    return { team, members };
  }

  async addMember(input: {
    organizationId: string;
    teamSlug: string;
    userId: string;
    role?: string;
    actorUserId: string;
  }) {
    const team = await this.getBySlugWithRoles(input.organizationId, input.teamSlug);
    const roleKey = await this.assertTeamRole(team.id, input.role ?? "contributor");
    const [organizationMember] = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.userId, input.userId),
        ),
      )
      .limit(1);
    if (!organizationMember) {
      throw new NotFoundException("Organization member not found");
    }

    const existing = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, input.userId)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException("User already belongs to this team");
    }

    const [member] = await this.db
      .insert(teamMembers)
      .values({
        organizationId: input.organizationId,
        teamId: team.id,
        userId: input.userId,
        role: roleKey,
      })
      .returning();

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.member.added",
      targetType: "team_member",
      targetId: member.id,
      payload: { teamId: team.id, userId: input.userId, role: roleKey },
    });

    return member;
  }

  async removeMember(input: {
    organizationId: string;
    teamSlug: string;
    userId: string;
    actorUserId: string;
  }) {
    const team = await this.getBySlug(input.organizationId, input.teamSlug);

    await this.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, input.userId)));

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.member.removed",
      targetType: "team_member",
      payload: { teamId: team.id, userId: input.userId },
    });

    return { success: true };
  }

  async update(input: {
    organizationId: string;
    teamSlug: string;
    name?: string;
    description?: string | null;
    actorUserId: string;
  }) {
    const team = await this.getBySlug(input.organizationId, input.teamSlug);
    const [updated] = await this.db
      .update(teams)
      .set({
        name: input.name,
        description: input.description,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id))
      .returning();
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.updated",
      targetType: "team",
      targetId: team.id,
    });
    return updated;
  }

  async delete(organizationId: string, teamSlug: string, actorUserId: string) {
    const team = await this.getBySlug(organizationId, teamSlug);
    await this.db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ teamId: null, updatedAt: new Date() })
        .where(eq(projects.teamId, team.id));
      await tx.delete(teamMembers).where(eq(teamMembers.teamId, team.id));
      await tx.delete(teamRoles).where(eq(teamRoles.teamId, team.id));
      await tx.delete(teams).where(eq(teams.id, team.id));
    });
    await this.auditService.record({
      organizationId,
      actorUserId,
      action: "team.deleted",
      targetType: "team",
      targetId: team.id,
      payload: { slug: team.slug },
    });
    return { success: true };
  }

  async listRoles(organizationId: string, teamSlug: string) {
    const team = await this.getBySlugWithRoles(organizationId, teamSlug);
    return this.db.select().from(teamRoles).where(eq(teamRoles.teamId, team.id));
  }

  async createRole(input: {
    organizationId: string;
    teamSlug: string;
    key: string;
    name: string;
    permissions: TeamPermission[];
    actorUserId: string;
  }) {
    const team = await this.getBySlugWithRoles(input.organizationId, input.teamSlug);
    const [existing] = await this.db
      .select({ id: teamRoles.id })
      .from(teamRoles)
      .where(and(eq(teamRoles.teamId, team.id), eq(teamRoles.key, input.key)))
      .limit(1);
    if (existing) throw new ConflictException("Team role key already exists");

    const [role] = await this.db
      .insert(teamRoles)
      .values({
        organizationId: input.organizationId,
        teamId: team.id,
        key: input.key,
        name: input.name,
        permissions: input.permissions,
      })
      .returning();
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.role.created",
      targetType: "team_role",
      targetId: role.id,
      payload: { teamId: team.id, key: role.key, permissions: role.permissions },
    });
    return role;
  }

  async deleteRole(input: {
    organizationId: string;
    teamSlug: string;
    roleKey: string;
    actorUserId: string;
  }) {
    const team = await this.getBySlugWithRoles(input.organizationId, input.teamSlug);
    const [role] = await this.db
      .select({ id: teamRoles.id, isSystem: teamRoles.isSystem })
      .from(teamRoles)
      .where(and(eq(teamRoles.teamId, team.id), eq(teamRoles.key, input.roleKey)))
      .limit(1);

    if (!role) {
      throw new NotFoundException("Team role not found");
    }
    if (role.isSystem) {
      throw new ConflictException("System team roles cannot be deleted");
    }

    const [assignedMember] = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.role, input.roleKey)))
      .limit(1);
    if (assignedMember) {
      throw new ConflictException("Reassign members using this role before deleting it");
    }

    await this.db.delete(teamRoles).where(eq(teamRoles.id, role.id));
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.role.deleted",
      targetType: "team_role",
      targetId: role.id,
      payload: { teamId: team.id, key: input.roleKey },
    });
    return { success: true };
  }

  async updateRole(input: {
    organizationId: string;
    teamSlug: string;
    roleKey: string;
    name: string;
    permissions: TeamPermission[];
    actorUserId: string;
  }) {
    const team = await this.getBySlugWithRoles(input.organizationId, input.teamSlug);
    const [role] = await this.db
      .select({ id: teamRoles.id, isSystem: teamRoles.isSystem })
      .from(teamRoles)
      .where(and(eq(teamRoles.teamId, team.id), eq(teamRoles.key, input.roleKey)))
      .limit(1);

    if (!role) {
      throw new NotFoundException("Team role not found");
    }
    if (role.isSystem) {
      throw new ConflictException("System team roles cannot be modified");
    }

    const [updated] = await this.db
      .update(teamRoles)
      .set({ name: input.name, permissions: input.permissions, updatedAt: new Date() })
      .where(eq(teamRoles.id, role.id))
      .returning();
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "team.role.updated",
      targetType: "team_role",
      targetId: role.id,
      payload: { teamId: team.id, key: input.roleKey, permissions: input.permissions },
    });
    return updated;
  }

  private async getBySlugWithRoles(organizationId: string, teamSlug: string) {
    const team = await this.getBySlug(organizationId, teamSlug);
    await this.ensureDefaultRoles(team.organizationId, team.id);
    return team;
  }

  private async assertTeamRole(teamId: string, roleKey: string) {
    const [role] = await this.db
      .select({ key: teamRoles.key })
      .from(teamRoles)
      .where(and(eq(teamRoles.teamId, teamId), eq(teamRoles.key, roleKey)))
      .limit(1);

    if (!role) {
      throw new NotFoundException("Team role not found");
    }

    return role.key;
  }

  private async ensureDefaultRoles(organizationId: string, teamId: string) {
    await this.createDefaultRoles(organizationId, teamId);
  }

  private async createDefaultRoles(organizationId: string, teamId: string) {
    for (const role of DEFAULT_TEAM_ROLES) {
      const [existing] = await this.db
        .select({ id: teamRoles.id, isSystem: teamRoles.isSystem })
        .from(teamRoles)
        .where(and(eq(teamRoles.teamId, teamId), eq(teamRoles.key, role.key)))
        .limit(1);

      if (!existing) {
        await this.db.insert(teamRoles).values({
          organizationId,
          teamId,
          ...role,
          isSystem: true,
        });
      } else if (existing.isSystem) {
        await this.db
          .update(teamRoles)
          .set({ name: role.name, permissions: role.permissions, updatedAt: new Date() })
          .where(eq(teamRoles.id, existing.id));
      }
    }
  }

  async getBySlug(organizationId: string, teamSlug: string) {
    const [team] = await this.db
      .select()
      .from(teams)
      .where(and(eq(teams.organizationId, organizationId), eq(teams.slug, teamSlug)))
      .limit(1);

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    return team;
  }
}
