import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { DATABASE, primaryDatabase } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { organizationMembers, organizations } from "../database/schema";

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  private readonly db: DatabaseClient;

  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.db = primaryDatabase(database);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgSlugValue = request.params.orgSlug;
    const userId = request.auth?.user.id;
    const orgSlug = Array.isArray(orgSlugValue) ? orgSlugValue[0] : orgSlugValue;

    if (!orgSlug || !userId) {
      throw new ForbiddenException("Organization context is missing");
    }

    const [row] = await this.db
      .select({
        organization: organizations,
        membership: organizationMembers,
      })
      .from(organizations)
      .innerJoin(
        organizationMembers,
        and(
          eq(organizationMembers.organizationId, organizations.id),
          eq(organizationMembers.userId, userId),
        ),
      )
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!row) {
      throw new NotFoundException("Organization not found");
    }

    request.organization = {
      organization: row.organization,
      membership: row.membership,
    };

    return true;
  }
}
