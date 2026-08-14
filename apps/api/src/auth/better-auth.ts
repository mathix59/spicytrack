import { betterAuth as createBetterAuth } from "better-auth";
import { genericOAuth, twoFactor } from "better-auth/plugins";
import { randomUUID } from "node:crypto";
import { createDatabasePool } from "../database/database.provider";
import { hashPassword, verifyPassword } from "./auth.utils";
import { sendAuthEmail } from "./auth-email";
import { authenticationConfiguration } from "./oidc-config";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/spicytrack";
const trustedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:5174").split(",");

export const betterAuthPool = createDatabasePool(databaseUrl, "Better Auth");

function isOidcCallback(context: unknown): boolean {
  const path = (context as { path?: unknown } | null)?.path;
  return typeof path === "string" && path.includes("/oauth2/callback/");
}

async function hasPendingInvitation(email: string): Promise<boolean> {
  const result = await betterAuthPool.query(
    `SELECT 1 FROM invitations i
     JOIN organization_roles r ON r.organization_id = i.organization_id AND r.key = i.role
     WHERE LOWER(i.email) = LOWER($1)
       AND i.accepted_at IS NULL
       AND i.revoked_at IS NULL
       AND i.expires_at > NOW()
     LIMIT 1`,
    [email],
  );
  return Boolean(result.rowCount);
}

async function acceptPendingInvitations(userId: string, email: string): Promise<void> {
  await betterAuthPool.query(
    `WITH valid_invitations AS (
       SELECT i.id
       FROM invitations i
       JOIN organization_roles r ON r.organization_id = i.organization_id AND r.key = i.role
       WHERE LOWER(i.email) = LOWER($2)
         AND i.accepted_at IS NULL
         AND i.revoked_at IS NULL
         AND i.expires_at > NOW()
       FOR UPDATE OF i
     ), accepted_invitations AS (
       UPDATE invitations i
       SET accepted_at = NOW()
       FROM valid_invitations v
       WHERE i.id = v.id
       RETURNING i.organization_id, i.role, i.invited_by_user_id
     )
     INSERT INTO organization_members (organization_id, user_id, role, invited_by_user_id)
     SELECT organization_id, $1, role, invited_by_user_id
     FROM accepted_invitations
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [userId, email],
  );
}

function appUrl(path: string, token: string): string {
  const base = (process.env.WEB_ORIGIN ?? "http://localhost:5174")
    .split(",")[0]
    .replace(/\/+$/, "");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

const betterAuth = createBetterAuth({
  database: betterAuthPool,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3002/api/better-auth",
  secret: authenticationConfiguration.secret,
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
  trustedOrigins,
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    expiresIn: authenticationConfiguration.sessionExpiresInSeconds,
    updateAge: authenticationConfiguration.sessionUpdateAgeSeconds,
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  rateLimit: {
    enabled: true,
    window: authenticationConfiguration.rateLimitWindowSeconds,
    max: authenticationConfiguration.rateLimitMax,
    customRules: {
      "/sign-in/email": {
        window: authenticationConfiguration.rateLimitWindowSeconds,
        max: authenticationConfiguration.signInRateLimitMax,
      },
      "/sign-in/oauth2": {
        window: authenticationConfiguration.rateLimitWindowSeconds,
        max: authenticationConfiguration.signInRateLimitMax,
      },
    },
  },
  account: {
    accountLinking: authenticationConfiguration.oidc
      ? {
          enabled: authenticationConfiguration.oidc.accountLinkingEnabled,
          trustedProviders: authenticationConfiguration.oidc.accountLinkingEnabled
            ? [authenticationConfiguration.oidc.providerId]
            : [],
          requireLocalEmailVerified: true,
        }
      : { enabled: false },
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      scope: "scope",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token }) => {
      const url = appUrl("/verify-email", token);
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your SpicyTrack email address",
        text: `Verify your email address by following this link: ${url}`,
      });
    },
  },
  emailAndPassword: {
    enabled: authenticationConfiguration.passwordEnabled,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      const url = appUrl("/reset-password", token);
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your SpicyTrack password",
        text: `Reset your password by following this link: ${url}`,
      });
    },
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(password, hash),
    },
  },
  plugins: [
    twoFactor({
      issuer: "SpicyTrack",
      totpOptions: {},
    }),
    ...(authenticationConfiguration.oidc
      ? [
          genericOAuth({
            config: [
              {
                providerId: authenticationConfiguration.oidc.providerId,
                discoveryUrl: authenticationConfiguration.oidc.discoveryUrl,
                clientId: authenticationConfiguration.oidc.clientId,
                clientSecret: authenticationConfiguration.oidc.clientSecret,
                scopes: ["openid", "profile", "email"],
                pkce: true,
                requireIssuerValidation: true,
                disableSignUp: authenticationConfiguration.oidc.accessMode === "existing",
              },
            ],
          }),
        ]
      : []),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const oidc = authenticationConfiguration.oidc;
          if (!isOidcCallback(context) || !oidc) return;
          if (oidc.requireVerifiedEmail && !user.emailVerified) return false;
          if (oidc.accessMode === "invited" && !(await hasPendingInvitation(user.email))) {
            return false;
          }
        },
        after: async (user) => {
          await betterAuthPool.query(
            `INSERT INTO users (
              id, email, password_hash, email_verified_at, name, avatar_url, created_at, updated_at
            ) VALUES ($1, $2, '', $3, $4, $5, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              email_verified_at = EXCLUDED.email_verified_at,
              name = EXCLUDED.name,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = NOW()`,
            [user.id, user.email, user.emailVerified ? new Date() : null, user.name, user.image],
          );
          const promoted = await betterAuthPool.query(
            `UPDATE users SET is_super_admin = true
             WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM users WHERE is_super_admin = true)`,
            [user.id],
          );
          if (promoted.rowCount) {
            await betterAuthPool.query(
              `INSERT INTO instance_settings (id, registrations_enabled, updated_by_user_id)
               VALUES (true, false, $1)
               ON CONFLICT (id) DO UPDATE SET registrations_enabled = false, updated_by_user_id = $1, updated_at = NOW()`,
              [user.id],
            );
          }
        },
      },
      update: {
        after: async (user) => {
          await betterAuthPool.query(
            `UPDATE users
             SET email = $2,
                 email_verified_at = CASE WHEN $3 THEN COALESCE(email_verified_at, NOW()) ELSE NULL END,
                 name = $4,
                 avatar_url = $5,
                 updated_at = NOW()
             WHERE id = $1`,
            [user.id, user.email, user.emailVerified, user.name, user.image],
          );
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          const oidc = authenticationConfiguration.oidc;
          if (!oidc || account.providerId !== oidc.providerId) return;

          const userResult = await betterAuthPool.query<{ email: string }>(
            "SELECT email FROM users WHERE id = $1",
            [account.userId],
          );
          const email = userResult.rows[0]?.email.toLowerCase();
          if (!email) return;

          if (oidc.accessMode === "invited") {
            await acceptPendingInvitations(account.userId, email);
            return;
          }

          if (!oidc.autoJoinOrganizationSlug || oidc.autoJoinEmailDomains.length === 0) return;

          const domain = email?.split("@").pop();
          if (!domain || !oidc.autoJoinEmailDomains.includes(domain)) return;

          await betterAuthPool.query(
            `INSERT INTO organization_members (organization_id, user_id, role)
             SELECT id, $1, 'member' FROM organizations WHERE slug = $2
             ON CONFLICT (organization_id, user_id) DO NOTHING`,
            [account.userId, oidc.autoJoinOrganizationSlug],
          );
        },
      },
    },
    session: {
      create: {
        after: async (session, context) => {
          if (!isOidcCallback(context) || !authenticationConfiguration.oidc) return;
          await betterAuthPool.query(
            `INSERT INTO audit_logs (
               id, organization_id, actor_user_id, action, target_type, target_id, payload
             )
             SELECT gen_random_uuid(), organization_id, $1, 'auth.sso_login', 'user', $1,
                    $2::jsonb
             FROM organization_members WHERE user_id = $1`,
            [
              session.userId,
              JSON.stringify({
                providerId: authenticationConfiguration.oidc.providerId,
                ipAddress: session.ipAddress ?? null,
                userAgent: session.userAgent ?? null,
              }),
            ],
          );
        },
      },
    },
  },
});

export const handleBetterAuthRequest = async (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin && !trustedOrigins.includes(origin)) {
    return Response.json({ message: "Untrusted origin." }, { status: 403 });
  }
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    const result = await betterAuthPool.query(
      "SELECT registrations_enabled FROM instance_settings WHERE id = true",
    );
    if (result.rows[0] && !result.rows[0].registrations_enabled) {
      const usersResult = await betterAuthPool.query("SELECT 1 FROM users LIMIT 1");
      if (usersResult.rowCount) {
        return Response.json({ message: "Registrations are disabled." }, { status: 403 });
      }
    }
  }
  return betterAuth.handler(request);
};

export const getBetterAuthSession = (headers: Headers) =>
  betterAuth.api.getSession({
    headers,
  });
