import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { generateOpaqueToken } from "../common/tokens";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { personalAccessTokens } from "../database/schema";

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
        expiresAt: personalAccessTokens.expiresAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
        createdAt: personalAccessTokens.createdAt,
      })
      .from(personalAccessTokens)
      .where(and(eq(personalAccessTokens.userId, userId), isNull(personalAccessTokens.revokedAt)))
      .orderBy(desc(personalAccessTokens.createdAt));
  }

  async create(input: { userId: string; name: string; expiresInDays?: number }) {
    const { token, hash } = generateOpaqueToken(TOKEN_PREFIX);
    const preview = token.slice(0, 12);
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [record] = await this.db
      .insert(personalAccessTokens)
      .values({
        userId: input.userId,
        name: input.name,
        tokenHash: hash,
        tokenPreview: preview,
        expiresAt,
      })
      .returning();

    return {
      token: {
        id: record.id,
        name: record.name,
        tokenPreview: record.tokenPreview,
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
