import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { DATABASE, primaryDatabase, type DatabaseClient } from "../database/database.provider";
import {
  authUsers,
  authVerifications,
  organizationMembers,
  organizations,
  users,
} from "../database/schema";

@Injectable()
export class DeleteUserService {
  private readonly db: DatabaseClient;
  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.db = primaryDatabase(database);
  }

  async delete(actorId: string, targetId: string, confirmationEmail: unknown) {
    return this.db.transaction(async (tx) => {
      // Match the super-admin role mutation lock order so concurrent deletions/demotions serialize.
      const admins = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isSuperAdmin, true))
        .for("update");
      if (!admins.some((admin) => admin.id === actorId))
        throw new ForbiddenException("Instance administrator access is required.");
      if (actorId === targetId) throw new ForbiddenException("You cannot delete your own account.");
      const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, targetId))
        .for("update")
        .limit(1);
      if (!target) throw new NotFoundException("User not found.");
      if (typeof confirmationEmail !== "string" || confirmationEmail !== target.email)
        throw new BadRequestException("Type the user's exact email address to confirm deletion.");
      // Lock Better Auth's matching record before removing credentials and sessions.
      await tx
        .select({ id: authUsers.id })
        .from(authUsers)
        .where(eq(authUsers.id, targetId))
        .for("update");
      const memberships = await tx
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, targetId));
      const owned = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.ownerUserId, targetId));
      const orgIds = [
        ...new Set([...memberships.map((m) => m.organizationId), ...owned.map((o) => o.id)]),
      ];
      if (orgIds.length) {
        const members = await tx
          .select()
          .from(organizationMembers)
          .where(inArray(organizationMembers.organizationId, orgIds))
          .orderBy(asc(organizationMembers.organizationId), asc(organizationMembers.id))
          .for("update");
        for (const orgId of orgIds) {
          const isOwner =
            owned.some((o) => o.id === orgId) ||
            members.some(
              (m) => m.organizationId === orgId && m.userId === targetId && m.role === "owner",
            );
          if (!isOwner) continue;
          const successor = members.find(
            (m) => m.organizationId === orgId && m.userId !== targetId && m.role === "owner",
          );
          if (!successor)
            throw new ConflictException(
              "Transfer organization ownership to another member before deleting this user.",
            );
          await tx
            .update(organizations)
            .set({ ownerUserId: successor.userId })
            .where(and(eq(organizations.id, orgId), eq(organizations.ownerUserId, targetId)));
        }
      }
      const verifications = await tx
        .select({ identifier: authVerifications.identifier })
        .from(authVerifications)
        .where(
          or(eq(authVerifications.value, targetId), eq(authVerifications.identifier, target.email)),
        );
      const identifiers = verifications.flatMap(({ identifier }) => [
        identifier,
        `2fa-attempts-${identifier}`,
        `2fa-otp-${identifier}`,
      ]);
      await tx
        .delete(authVerifications)
        .where(
          or(
            eq(authVerifications.value, targetId),
            eq(authVerifications.identifier, target.email),
            ...(identifiers.length ? [inArray(authVerifications.identifier, identifiers)] : []),
          ),
        );
      await tx.execute(
        sql`DELETE FROM mcp_credential_projects WHERE credential_id IN (SELECT id FROM mcp_credentials WHERE created_by_user_id = ${targetId}::uuid)`,
      );
      await tx.execute(
        sql`DELETE FROM invitations WHERE invited_by_user_id = ${targetId}::uuid OR lower(email) = lower(${target.email})`,
      );
      // The schema deliberately has no foreign keys: remove personal rows explicitly.
      for (const [table, column] of [
        ["session", "user_id"],
        ["account", "user_id"],
        ["twoFactor", "userId"],
        ["personal_access_tokens", "user_id"],
        ["mcp_credentials", "created_by_user_id"],
        ["team_members", "user_id"],
        ["organization_members", "user_id"],
        ["project_saved_searches", "user_id"],
        ["issue_comments", "user_id"],
      ])
        await tx.execute(
          sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${targetId}::uuid`,
        );
      // The deleted user's network identifiers are personal data; their actions stay logged.
      await tx.execute(
        sql`UPDATE audit_logs SET ip_address = NULL, user_agent = NULL WHERE actor_user_id = ${targetId}::uuid`,
      );
      // Preserve shared project data and its history without dangling actor references.
      for (const [table, column] of [
        ["instance_settings", "updated_by_user_id"],
        ["organization_mcp_settings", "updated_by_user_id"],
        ["organization_members", "invited_by_user_id"],
        ["issues", "assigned_user_id"],
        ["issues", "resolved_by_user_id"],
        ["issue_activity", "actor_user_id"],
        ["audit_logs", "actor_user_id"],
        ["repo_connections", "created_by_user_id"],
        ["organization_ai_settings", "updated_by_user_id"],
        ["organization_github_app_settings", "updated_by_user_id"],
        ["autofix_runs", "triggered_by_user_id"],
        ["autofix_runs", "reviewed_by_user_id"],
        ["issue_triage_runs", "generated_by_user_id"],
        ["organization_ai_pricing_overrides", "updated_by_user_id"],
      ])
        await tx.execute(
          sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = NULL WHERE ${sql.identifier(column)} = ${targetId}::uuid`,
        );
      await tx.execute(
        sql`UPDATE audit_logs SET target_id = NULL, payload = '{}'::jsonb WHERE target_type = 'user' AND target_id = ${targetId}::uuid`,
      );
      await tx.delete(authUsers).where(eq(authUsers.id, targetId));
      await tx.delete(users).where(eq(users.id, targetId));
      return { success: true };
    });
  }
}
