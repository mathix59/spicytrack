import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { generateOpaqueToken } from "../common/tokens";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { organizationMembers, organizations, personalAccessTokens } from "../database/schema";
import type { TokenScope } from "./token-scopes";

const TOKEN_PREFIX = "pat";

@Injectable()
export class PersonalTokensService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async list(userId: string) {
    return this.db
      .select({
        id: personalAccessTokens.id,
        name: personalAccessTokens.name,
        tokenPreview: personalAccessTokens.tokenPreview,
        scopes: personalAccessTokens.scopes,
        organizationId: personalAccessTokens.organizationId,
        organizationName: organizations.name,
        expiresAt: personalAccessTokens.expiresAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
        createdAt: personalAccessTokens.createdAt,
      })
      .from(personalAccessTokens)
      .leftJoin(organizations, eq(organizations.id, personalAccessTokens.organizationId))
      .where(and(eq(personalAccessTokens.userId, userId), isNull(personalAccessTokens.revokedAt)))
      .orderBy(desc(personalAccessTokens.createdAt));
  }

  async create(input: {
    userId: string;
    name: string;
    scopes: TokenScope[];
    organizationId: string | null;
    expiresInDays: number;
  }) {
    let organizationName: string | null = null;
    if (input.organizationId) {
      const [membership] = await this.db
        .select({ name: organizations.name })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(
          and(
            eq(organizationMembers.organizationId, input.organizationId),
            eq(organizationMembers.userId, input.userId),
          ),
        )
        .limit(1);
      if (!membership) {
        throw new BadRequestException("organizationId must be an organization you belong to");
      }
      organizationName = membership.name;
    }

    const { token, hash } = generateOpaqueToken(TOKEN_PREFIX);
    const preview = token.slice(0, 12);
    const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

    const [record] = await this.db
      .insert(personalAccessTokens)
      .values({
        userId: input.userId,
        name: input.name,
        tokenHash: hash,
        tokenPreview: preview,
        scopes: input.scopes,
        organizationId: input.organizationId,
        expiresAt,
      })
      .returning();

    return {
      token: {
        id: record.id,
        name: record.name,
        tokenPreview: record.tokenPreview,
        scopes: record.scopes,
        organizationId: record.organizationId,
        organizationName,
        expiresAt: record.expiresAt,
        lastUsedAt: record.lastUsedAt,
        createdAt: record.createdAt,
      },
      secret: token,
    };
  }

  async revoke(input: { userId: string; tokenId: string }) {
    const [record] = await this.db
      .update(personalAccessTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(personalAccessTokens.id, input.tokenId),
          eq(personalAccessTokens.userId, input.userId),
          isNull(personalAccessTokens.revokedAt),
        ),
      )
      .returning();

    if (!record) {
      throw new NotFoundException("Personal access token not found");
    }

    return { success: true };
  }
}
