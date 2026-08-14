import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditService } from "../audit/audit.service";
import { and, eq, sql } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  invitations,
  organizationMembers,
  organizationRoles,
  organizations,
  users,
} from "../database/schema";
import { ROLE_PERMISSIONS } from "../rbac/permissions.constants";
import type { Permission } from "../rbac/permissions.types";
import {
  assertRoleManageable,
  assertRolePermissionsAssignable,
  type RolePolicyRecord,
} from "../rbac/organization-role-policy";
import { createHash, randomBytes } from "node:crypto";
import { EmailService } from "../email/email.service";
import { OrganizationsJobsService } from "./organizations-jobs.service";
import { OrganizationsOverviewService } from "./organizations-overview.service";

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly organizationsJobsService: OrganizationsJobsService,
    private readonly organizationsOverviewService: OrganizationsOverviewService,
    private readonly auditService: AuditService,
  ) {}

  async listForUser(userId: string) {
    return this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId));
  }

  async createOrganization(input: { userId: string; name: string; slug: string }) {
    const memberships = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, input.userId));

    if (memberships.length > 0 && !memberships.some((membership) => membership.role === "owner")) {
      throw new ForbiddenException("Only organization owners can create another organization");
    }

    const existing = await this.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, input.slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException("Organization slug already exists");
    }

    const [organization] = await this.db
      .insert(organizations)
      .values({
        name: input.name,
        slug: input.slug,
        ownerUserId: input.userId,
      })
      .returning();

    await this.db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: input.userId,
      role: "owner",
    });
    await this.db.insert(organizationRoles).values(
      Object.entries(ROLE_PERMISSIONS).map(([key, permissions]) => ({
        organizationId: organization.id,
        key,
        name: key[0]!.toUpperCase() + key.slice(1),
        permissions,
        isSystem: true,
      })),
    );

    return organization;
  }

  async getOrganization(organizationId: string) {
    const [organization] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return organization;
  }

  async listMembers(organizationId: string) {
    return this.db
      .select({
        memberId: organizationMembers.id,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
        userId: users.id,
        email: users.email,
        name: users.name,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId));
  }

  async listRoles(organizationId: string) {
    await this.ensureSystemRoles(organizationId);
    return this.db
      .select()
      .from(organizationRoles)
      .where(eq(organizationRoles.organizationId, organizationId));
  }
  async createRole(
    organizationId: string,
    input: { key: string; name: string; permissions: Permission[] },
    actorUserId: string,
  ) {
    const actor = await this.getActorRolePolicy(organizationId, actorUserId);
    assertRolePermissionsAssignable(actor, input);
    const [existing] = await this.db
      .select({ id: organizationRoles.id })
      .from(organizationRoles)
      .where(
        and(
          eq(organizationRoles.organizationId, organizationId),
          eq(organizationRoles.key, input.key),
        ),
      )
      .limit(1);
    if (existing) throw new ConflictException("Organization role key already exists");

    const [role] = await this.db
      .insert(organizationRoles)
      .values({ organizationId, key: input.key, name: input.name, permissions: input.permissions })
      .returning();
    await this.auditService.record({
      organizationId,
      actorUserId,
      action: "organization.role.created",
      targetType: "organization_role",
      targetId: role.id,
      payload: { key: role.key, permissions: role.permissions },
    });
    return role;
  }

  async updateRole(
    organizationId: string,
    key: string,
    input: { name: string; permissions: Permission[] },
    actorUserId: string,
  ) {
    const [role] = await this.db
      .select()
      .from(organizationRoles)
      .where(
        and(eq(organizationRoles.organizationId, organizationId), eq(organizationRoles.key, key)),
      )
      .limit(1);
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem) throw new ConflictException("System organization roles cannot be modified");
    const actor = await this.getActorRolePolicy(organizationId, actorUserId);
    const target = { key: role.key, permissions: role.permissions as Permission[] };
    assertRoleManageable(actor, target);
    assertRolePermissionsAssignable(actor, { key, permissions: input.permissions });
    const [updated] = await this.db
      .update(organizationRoles)
      .set({ name: input.name, permissions: input.permissions, updatedAt: new Date() })
      .where(eq(organizationRoles.id, role.id))
      .returning();
    await this.auditService.record({
      organizationId,
      actorUserId,
      action: "organization.role.updated",
      targetType: "organization_role",
      targetId: role.id,
      payload: { key, permissions: input.permissions },
    });
    return updated;
  }

  async deleteRole(organizationId: string, key: string, actorUserId: string) {
    const [role] = await this.db
      .select()
      .from(organizationRoles)
      .where(
        and(eq(organizationRoles.organizationId, organizationId), eq(organizationRoles.key, key)),
      )
      .limit(1);
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem) throw new ConflictException("System organization roles cannot be deleted");
    assertRoleManageable(await this.getActorRolePolicy(organizationId, actorUserId), {
      key: role.key,
      permissions: role.permissions as Permission[],
    });
    const [assigned] = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.role, key),
        ),
      )
      .limit(1);
    if (assigned)
      throw new ConflictException("Reassign members using this role before deleting it");
    const [pendingInvitation] = await this.db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          eq(invitations.role, key),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.revokedAt} IS NULL`,
        ),
      )
      .limit(1);
    if (pendingInvitation) {
      throw new ConflictException("Revoke invitations using this role before deleting it");
    }
    await this.db.delete(organizationRoles).where(eq(organizationRoles.id, role.id));
    await this.auditService.record({
      organizationId,
      actorUserId,
      action: "organization.role.deleted",
      targetType: "organization_role",
      targetId: role.id,
      payload: { key },
    });
    return { success: true };
  }

  async getOverview(input: { organizationId: string; userId: string; role: string }) {
    return this.organizationsOverviewService.getOverview(input);
  }

  async getQueueOverview(
    organizationId: string,
    filters: {
      status?: "pending" | "running" | "failed";
      type?: string;
      projectId?: string;
      limit?: number;
    },
  ) {
    return this.organizationsJobsService.getQueueOverview(organizationId, filters);
  }

  async requeueFailedJob(organizationId: string, jobId: string) {
    return this.organizationsJobsService.requeueFailedJob(organizationId, jobId);
  }

  async createInvitation(input: {
    organizationId: string;
    invitedByUserId: string;
    email: string;
    role: string;
  }) {
    await this.assertRoleAssignable(input.organizationId, input.invitedByUserId, input.role);
    await this.db
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.organizationId, input.organizationId),
          eq(invitations.email, input.email),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.revokedAt} IS NULL`,
        ),
      );

    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const [invitation] = await this.db
      .insert(invitations)
      .values({
        organizationId: input.organizationId,
        invitedByUserId: input.invitedByUserId,
        email: input.email,
        role: input.role,
        tokenHash,
        expiresAt,
      })
      .returning();

    await this.emailService.send({
      to: invitation.email,
      subject: "Invitation a rejoindre une organisation SpicyTrack",
      text: `Tu as ete invite a rejoindre une organisation SpicyTrack avec le role ${invitation.role}. Accepte l'invitation (valable 7 jours) : ${this.buildInvitationLink(token)}`,
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.invitedByUserId,
      action: "organization.invitation.created",
      targetType: "invitation",
      targetId: invitation.id,
      payload: { email: invitation.email, role: invitation.role },
    });

    return {
      invitation,
      token,
    };
  }

  async listPendingInvitations(organizationId: string) {
    return this.db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        createdAt: invitations.createdAt,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.revokedAt} IS NULL`,
        ),
      );
  }

  async resendInvitation(input: {
    organizationId: string;
    invitedByUserId: string;
    invitationId: string;
  }) {
    const [invitation] = await this.db
      .select({ email: invitations.email, role: invitations.role })
      .from(invitations)
      .where(
        and(
          eq(invitations.id, input.invitationId),
          eq(invitations.organizationId, input.organizationId),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.revokedAt} IS NULL`,
        ),
      )
      .limit(1);

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    return this.createInvitation({
      organizationId: input.organizationId,
      invitedByUserId: input.invitedByUserId,
      email: invitation.email,
      role: invitation.role,
    });
  }

  async acceptInvitation(input: { token: string; userId: string }) {
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    return this.db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .for("update")
        .limit(1);

      if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
        throw new NotFoundException("Invitation not found");
      }
      if (invitation.expiresAt <= new Date()) {
        throw new ForbiddenException("Invitation has expired");
      }

      const [[user], [role]] = await Promise.all([
        tx.select().from(users).where(eq(users.id, input.userId)).limit(1),
        tx
          .select({ id: organizationRoles.id })
          .from(organizationRoles)
          .where(
            and(
              eq(organizationRoles.organizationId, invitation.organizationId),
              eq(organizationRoles.key, invitation.role),
            ),
          )
          .limit(1),
      ]);
      if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ForbiddenException("Invitation email does not match current user");
      }
      if (!role) throw new NotFoundException("Role not found");

      await tx
        .insert(organizationMembers)
        .values({
          organizationId: invitation.organizationId,
          userId: input.userId,
          role: invitation.role,
          invitedByUserId: invitation.invitedByUserId,
        })
        .onConflictDoNothing({
          target: [organizationMembers.organizationId, organizationMembers.userId],
        });

      const [updatedInvitation] = await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id))
        .returning();
      return updatedInvitation;
    });
  }

  private buildInvitationLink(token: string) {
    const baseUrl = (
      this.configService.get<string>("WEB_BASE_URL") ?? "http://localhost:5174"
    ).replace(/\/+$/, "");

    return `${baseUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
  }

  async updateMemberRole(input: {
    organizationId: string;
    actorUserId: string;
    memberId: string;
    role: string;
  }) {
    await this.assertRoleExists(input.organizationId, input.role);
    const updated = await this.db.transaction(async (tx) => {
      const memberships = await tx
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, input.organizationId))
        .for("update");
      const actorMembership = memberships.find(
        (membership) => membership.userId === input.actorUserId,
      );
      const target = memberships.find((membership) => membership.id === input.memberId);
      if (!actorMembership) throw new ForbiddenException("Organization membership is required");
      if (!target) throw new NotFoundException("Member not found");
      if (target.userId === input.actorUserId && actorMembership.role !== "owner") {
        throw new ForbiddenException("You cannot modify your own role");
      }

      const [actor, currentRole, desiredRole] = await Promise.all([
        this.getRolePolicy(input.organizationId, actorMembership.role),
        this.getRolePolicy(input.organizationId, target.role),
        this.getRolePolicy(input.organizationId, input.role),
      ]);
      assertRoleManageable(actor, currentRole);
      assertRolePermissionsAssignable(actor, desiredRole);
      if (
        target.role === "owner" &&
        input.role !== "owner" &&
        memberships.filter((membership) => membership.role === "owner").length <= 1
      ) {
        throw new ForbiddenException("At least one organization owner is required");
      }

      const [updated] = await tx
        .update(organizationMembers)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(organizationMembers.id, target.id))
        .returning();
      return updated;
    });
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "organization.member.role_updated",
      targetType: "organization_member",
      targetId: input.memberId,
      payload: { role: input.role },
    });
    return updated;
  }

  private async assertRoleExists(organizationId: string, role: string) {
    await this.getRolePolicy(organizationId, role);
  }

  private async assertRoleAssignable(organizationId: string, actorUserId: string, role: string) {
    const [actor, desired] = await Promise.all([
      this.getActorRolePolicy(organizationId, actorUserId),
      this.getRolePolicy(organizationId, role),
    ]);
    assertRolePermissionsAssignable(actor, desired);
  }

  private async getActorRolePolicy(organizationId: string, actorUserId: string) {
    const [membership] = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, actorUserId),
        ),
      )
      .limit(1);
    if (!membership) throw new ForbiddenException("Organization membership is required");
    return this.getRolePolicy(organizationId, membership.role);
  }

  private async getRolePolicy(organizationId: string, role: string): Promise<RolePolicyRecord> {
    const systemPermissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
    if (systemPermissions) return { key: role, permissions: systemPermissions };

    const [found] = await this.db
      .select({ key: organizationRoles.key, permissions: organizationRoles.permissions })
      .from(organizationRoles)
      .where(
        and(eq(organizationRoles.organizationId, organizationId), eq(organizationRoles.key, role)),
      )
      .limit(1);
    if (!found) throw new NotFoundException("Role not found");
    return { key: found.key, permissions: found.permissions as Permission[] };
  }

  private async ensureSystemRoles(organizationId: string) {
    await this.db
      .insert(organizationRoles)
      .values(
        Object.entries(ROLE_PERMISSIONS).map(([key, permissions]) => ({
          organizationId,
          key,
          name: key[0]!.toUpperCase() + key.slice(1),
          permissions,
          isSystem: true,
        })),
      )
      .onConflictDoUpdate({
        target: [organizationRoles.organizationId, organizationRoles.key],
        set: {
          name: sql`excluded.name`,
          permissions: sql`excluded.permissions`,
          isSystem: true,
          updatedAt: new Date(),
        },
      });
  }

  async removeMember(input: { organizationId: string; actorUserId: string; memberId: string }) {
    const removed = await this.db.transaction(async (tx) => {
      const memberships = await tx
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, input.organizationId))
        .for("update");
      const actorMembership = memberships.find(
        (membership) => membership.userId === input.actorUserId,
      );
      const target = memberships.find((membership) => membership.id === input.memberId);
      if (!actorMembership) throw new ForbiddenException("Organization membership is required");
      if (!target) throw new NotFoundException("Member not found");
      if (target.userId === input.actorUserId) {
        throw new ForbiddenException("You cannot remove yourself");
      }

      const [actor, targetRole] = await Promise.all([
        this.getRolePolicy(input.organizationId, actorMembership.role),
        this.getRolePolicy(input.organizationId, target.role),
      ]);
      assertRoleManageable(actor, targetRole);
      await tx.delete(organizationMembers).where(eq(organizationMembers.id, target.id));
      return { success: true };
    });
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "organization.member.removed",
      targetType: "organization_member",
      targetId: input.memberId,
    });
    return removed;
  }
}
