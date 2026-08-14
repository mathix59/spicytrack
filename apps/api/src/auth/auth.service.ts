import { Inject, Injectable } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { DATABASE, primaryDatabase } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  authUsers,
  organizationMembers,
  organizationRoles,
  organizations,
  users,
} from "../database/schema";
import { ROLE_PERMISSIONS } from "../rbac/permissions.constants";

@Injectable()
export class AuthService {
  private readonly db: DatabaseClient;

  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.db = primaryDatabase(database);
  }

  async getProfile(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerifiedAt: users.emailVerifiedAt,
        twoFactorEnabled: authUsers.twoFactorEnabled,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .innerJoin(authUsers, eq(authUsers.id, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    const memberships = await this.db
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

    const organizationIds = memberships.map((membership) => membership.id);
    const roles = organizationIds.length
      ? await this.db
          .select({
            organizationId: organizationRoles.organizationId,
            key: organizationRoles.key,
            permissions: organizationRoles.permissions,
          })
          .from(organizationRoles)
          .where(inArray(organizationRoles.organizationId, organizationIds))
      : [];
    const permissionsByRole = new Map(
      roles.map((role) => [`${role.organizationId}:${role.key}`, role.permissions as string[]]),
    );

    return {
      user,
      memberships: memberships.map((membership) => ({
        ...membership,
        permissions:
          permissionsByRole.get(`${membership.id}:${membership.role}`) ??
          ROLE_PERMISSIONS[membership.role as keyof typeof ROLE_PERMISSIONS] ??
          [],
      })),
    };
  }
}
