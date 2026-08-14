import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE, primaryDatabase } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { personalAccessTokens, users } from "../database/schema";
import type { AuthenticatedRequest } from "../common/authenticated-request";
import { hashOpaqueToken } from "../common/tokens";
import { getBetterAuthSession } from "./better-auth";
import { fromNodeHeaders } from "better-auth/node";

const PAT_PREFIX = "pat_";

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly db: DatabaseClient;

  constructor(@Inject(DATABASE) database: DatabaseClient) {
    this.db = primaryDatabase(database);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";
    if (bearerToken.startsWith(PAT_PREFIX)) {
      return this.authenticateWithPersonalAccessToken(request, bearerToken);
    }

    const betterSession = await getBetterAuthSession(fromNodeHeaders(request.headers));
    if (betterSession?.user) {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, betterSession.user.id))
        .limit(1);

      if (user) {
        request.auth = { user };
        return true;
      }
    }

    throw new UnauthorizedException("Missing credentials");
  }

  private async authenticateWithPersonalAccessToken(
    request: AuthenticatedRequest,
    token: string,
  ): Promise<boolean> {
    const tokenHash = hashOpaqueToken(token);
    const [patRecord] = await this.db
      .select()
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.tokenHash, tokenHash))
      .limit(1);

    if (
      !patRecord ||
      patRecord.revokedAt ||
      (patRecord.expiresAt && patRecord.expiresAt <= new Date())
    ) {
      throw new UnauthorizedException("Personal access token is invalid or expired");
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, patRecord.userId))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    await this.db
      .update(personalAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(personalAccessTokens.id, patRecord.id));

    request.auth = { user };
    return true;
  }
}
