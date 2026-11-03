import { randomUUID } from "node:crypto";
import { hashOpaqueToken } from "../src/common/tokens";
import { ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import { instanceSettings, personalAccessTokens, users } from "../src/database/schema";
import { fromNodeHeaders } from "better-auth/node";
import { betterAuthPool, handleBetterAuthRequest } from "../src/auth/better-auth";
import { AppModule } from "../src/app.module";
import { eq } from "drizzle-orm";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const SMTP_HOST = process.env.E2E_SMTP_HOST ?? "localhost";
const SMTP_PORT = Number(process.env.E2E_SMTP_PORT ?? 1025);
const ORIGIN = process.env.WEB_ORIGIN?.split(",")[0] ?? "http://localhost:5174";

type MailpitMessage = {
  ID: string;
  To: Array<{ Address: string }>;
  Subject: string;
};

async function findEmail(to: string): Promise<{ Text: string }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const payload = (await response.json()) as { messages: MailpitMessage[] };
    const message = payload.messages?.[0];

    if (message) {
      const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      return (await detail.json()) as { Text: string };
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No email received for ${to}`);
}

function extractToken(text: string, path: string): string {
  const match = text.match(new RegExp(`${path}\\?token=([^\\s]+)`));

  if (!match) {
    throw new Error(`No ${path} link found in email:\n${text}`);
  }

  return decodeURIComponent(match[1]);
}

function sessionCookie(setCookie: string | string[] | undefined): string {
  const headers = Array.isArray(setCookie) ? setCookie : [setCookie ?? ""];
  const cookies = headers.filter(Boolean).map((header) => header.split(";")[0]);

  if (cookies.length === 0) {
    throw new Error("No set-cookie header in response");
  }

  return cookies.join("; ");
}

describe("Auth flow (e2e)", () => {
  let app: NestFastifyApplication;
  let db: DatabaseClient;
  const email = `auth-flow-${Date.now()}@spicytrack.local`;
  const password = "Sup3rSecret!42";
  let authenticatedCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    db = moduleFixture.get(DATABASE);
    await db
      .insert(instanceSettings)
      .values({
        id: true,
        registrationsEnabled: true,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
        smtpFrom: "noreply@spicytrack.local",
      })
      .onConflictDoUpdate({
        target: instanceSettings.id,
        set: {
          registrationsEnabled: true,
          smtpHost: SMTP_HOST,
          smtpPort: SMTP_PORT,
          smtpFrom: "noreply@spicytrack.local",
          updatedAt: new Date(),
        },
      });

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");

    const fastify = app.getHttpAdapter().getInstance();
    fastify.all("/api/better-auth/*", async (request, reply) => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const authRequest = new Request(url, {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      });
      const authResponse = await handleBetterAuthRequest(authRequest);

      reply.status(authResponse.status);
      authResponse.headers.forEach((value: string, key: string) => {
        reply.header(key, value);
      });
      return reply.send(authResponse.body ? await authResponse.text() : undefined);
    });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await betterAuthPool.query(
      `DELETE FROM "session" WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`,
      [email],
    );
    await betterAuthPool.query(
      `DELETE FROM "account" WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`,
      [email],
    );
    await betterAuthPool.query(`DELETE FROM "user" WHERE email = $1`, [email]);
    await betterAuthPool.query(`DELETE FROM users WHERE email = $1`, [email]);
    await app.close();
  });

  it("signs up, verifies email, signs in, and reaches a protected endpoint", async () => {
    const signUp = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-up/email",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { email, password, name: "Auth Flow E2E" },
    });

    expect(signUp.statusCode).toBe(200);
    expect(signUp.json().user.emailVerified).toBe(false);

    const verificationEmail = await findEmail(email);
    const verifyToken = extractToken(verificationEmail.Text, "/verify-email");

    const verify = await app.inject({
      method: "GET",
      url: `/api/better-auth/verify-email?token=${encodeURIComponent(verifyToken)}`,
      headers: { origin: ORIGIN },
    });

    expect(verify.statusCode).toBe(200);

    const signIn = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/email",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { email, password },
    });

    expect(signIn.statusCode).toBe(200);
    expect(signIn.json().user.emailVerified).toBe(true);

    const setCookie = String(signIn.headers["set-cookie"] ?? "");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/Domain=/i);

    const cookieHeader = sessionCookie(signIn.headers["set-cookie"]);
    authenticatedCookie = cookieHeader;

    const session = await app.inject({
      method: "GET",
      url: "/api/better-auth/get-session",
      headers: { origin: ORIGIN, cookie: cookieHeader },
    });

    expect(session.statusCode).toBe(200);
    expect(session.json().user.email).toBe(email);

    const withCookie = await app.inject({
      method: "GET",
      url: "/api/organizations",
      headers: { origin: ORIGIN, cookie: cookieHeader },
    });

    expect(withCookie.statusCode).toBe(200);

    const withoutCookie = await app.inject({
      method: "GET",
      url: "/api/organizations",
    });

    expect(withoutCookie.statusCode).toBe(401);

    const untrustedOrigin = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/email",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      payload: { email, password },
    });
    expect(untrustedOrigin.statusCode).toBe(403);
  });

  it("resets the password and revokes existing sessions", async () => {
    const signIn = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/email",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { email, password },
    });

    expect(signIn.statusCode).toBe(200);
    const oldCookie = sessionCookie(signIn.headers["set-cookie"]);

    const request = await app.inject({
      method: "POST",
      url: "/api/better-auth/request-password-reset",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { email, redirectTo: `${ORIGIN}/reset-password` },
    });

    expect(request.statusCode).toBe(200);

    const resetEmail = await findEmail(email);
    const resetToken = extractToken(resetEmail.Text, "/reset-password");
    const newPassword = "N3wSecret!Pass99";

    const reset = await app.inject({
      method: "POST",
      url: "/api/better-auth/reset-password",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { token: resetToken, newPassword },
    });

    expect(reset.statusCode).toBe(200);

    const oldPassword = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/email",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { email, password },
    });

    expect(oldPassword.statusCode).toBe(401);

    const revokedSession = await app.inject({
      method: "GET",
      url: "/api/organizations",
      headers: { origin: ORIGIN, cookie: oldCookie },
    });

    expect(revokedSession.statusCode).toBe(401);

    const newSignIn = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/email",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { email, password: newPassword },
    });

    expect(newSignIn.statusCode).toBe(200);
    authenticatedCookie = sessionCookie(newSignIn.headers["set-cookie"]);
  });

  it("revokes and expires personal access tokens immediately", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/auth/tokens",
      headers: { origin: ORIGIN, cookie: authenticatedCookie, "content-type": "application/json" },
      payload: { name: "Auth flow PAT", scopes: ["read"] },
    });
    expect(create.statusCode).toBe(201);
    const { secret, token } = create.json() as { secret: string; token: { id: string } };

    const valid = await app.inject({
      method: "GET",
      url: "/api/organizations",
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(valid.statusCode).toBe(200);

    const revoke = await app.inject({
      method: "DELETE",
      url: `/api/auth/tokens/${token.id}`,
      headers: { origin: ORIGIN, cookie: authenticatedCookie },
    });
    expect(revoke.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/organizations",
          headers: { authorization: `Bearer ${secret}` },
        })
      ).statusCode,
    ).toBe(401);

    const expiring = await app.inject({
      method: "POST",
      url: "/api/auth/tokens",
      headers: { origin: ORIGIN, cookie: authenticatedCookie, "content-type": "application/json" },
      payload: { name: "Expired PAT", scopes: ["read"] },
    });
    const expiredPayload = expiring.json() as { secret: string; token: { id: string } };
    await db
      .update(personalAccessTokens)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(personalAccessTokens.id, expiredPayload.token.id));
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/organizations",
          headers: { authorization: `Bearer ${expiredPayload.secret}` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/organizations",
          headers: { authorization: "Bearer pat_malformed" },
        })
      ).statusCode,
    ).toBe(401);

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    await db.delete(personalAccessTokens).where(eq(personalAccessTokens.userId, user.id));
  });

  it("validates invitation state in PostgreSQL before allowing signup with closed registration", async () => {
    const invitedEmail = `invited-${randomUUID()}@example.test`;
    const invitationId = randomUUID();
    const token = randomUUID();
    const organizationId = randomUUID();
    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    const [settings] = await db.select().from(instanceSettings);
    const signup = (providedToken: string = token, providedEmail = invitedEmail) =>
      app.inject({
        method: "POST",
        url: "/api/better-auth/sign-up/email",
        headers: {
          origin: ORIGIN,
          "content-type": "application/json",
          "x-invitation-token": providedToken,
        },
        payload: { email: providedEmail, password, name: "Invited user" },
      });

    try {
      await betterAuthPool.query(
        `INSERT INTO organizations (id, name, slug, owner_user_id) VALUES ($1, 'Invitation test', $3, $2)`,
        [organizationId, owner.id, `invitation-${organizationId}`],
      );
      await betterAuthPool.query(
        `INSERT INTO organization_roles (organization_id, key, name, permissions)
         VALUES ($1, 'viewer', 'Viewer', '["org.read"]'::jsonb)`,
        [organizationId],
      );
      await betterAuthPool.query(
        `INSERT INTO invitations (id, organization_id, email, role, token_hash, invited_by_user_id, expires_at)
         VALUES ($1, $2, $3, 'viewer', $4, $5, NOW() + INTERVAL '1 day')`,
        [invitationId, organizationId, invitedEmail, hashOpaqueToken(token), owner.id],
      );
      await db
        .update(instanceSettings)
        .set({ registrationsEnabled: false })
        .where(eq(instanceSettings.id, true));
      expect((await signup("wrong-token")).statusCode).toBe(403);
      expect((await signup(token, `wrong-${invitedEmail}`)).statusCode).toBe(403);
      for (const state of ["expired", "accepted", "revoked", "missing-role"]) {
        await betterAuthPool.query(
          `UPDATE invitations SET
             expires_at = CASE WHEN $2 = 'expired' THEN NOW() - INTERVAL '1 day' ELSE NOW() + INTERVAL '1 day' END,
             accepted_at = CASE WHEN $2 = 'accepted' THEN NOW() ELSE NULL END,
             revoked_at = CASE WHEN $2 = 'revoked' THEN NOW() ELSE NULL END,
             role = CASE WHEN $2 = 'missing-role' THEN 'deleted-role' ELSE 'viewer' END
           WHERE id = $1`,
          [invitationId, state],
        );
        expect({ state, status: (await signup()).statusCode }).toEqual({ state, status: 403 });
      }
      const rejectedUsers = await betterAuthPool.query(`SELECT id FROM "user" WHERE email = $1`, [
        invitedEmail,
      ]);
      expect(rejectedUsers.rows).toHaveLength(0);

      await betterAuthPool.query(`UPDATE invitations SET role = 'viewer' WHERE id = $1`, [
        invitationId,
      ]);
      const created = await signup(token, invitedEmail.toUpperCase());
      expect(created.statusCode).toBe(200);
      const verificationEmail = await findEmail(invitedEmail);
      const verification = await app.inject({
        method: "GET",
        url: `/api/better-auth/verify-email?token=${encodeURIComponent(extractToken(verificationEmail.Text, "/verify-email"))}`,
        headers: { origin: ORIGIN },
      });
      expect(verification.statusCode).toBe(200);
      const signIn = await app.inject({
        method: "POST",
        url: "/api/better-auth/sign-in/email",
        headers: { origin: ORIGIN, "content-type": "application/json" },
        payload: { email: invitedEmail, password },
      });
      expect(signIn.statusCode).toBe(200);
      const accepted = await app.inject({
        method: "POST",
        url: "/api/organizations/invitations/accept",
        headers: { origin: ORIGIN, cookie: sessionCookie(signIn.headers["set-cookie"]) },
        payload: { token },
      });
      expect(accepted.statusCode).toBe(201);
      const membership = await betterAuthPool.query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organizationId, created.json().user.id],
      );
      expect(membership.rows).toEqual([{ role: "viewer" }]);
    } finally {
      await db
        .update(instanceSettings)
        .set({ registrationsEnabled: settings.registrationsEnabled })
        .where(eq(instanceSettings.id, true));
      await betterAuthPool.query(`DELETE FROM audit_logs WHERE organization_id = $1`, [
        organizationId,
      ]);
      await betterAuthPool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [
        organizationId,
      ]);
      await betterAuthPool.query(`DELETE FROM invitations WHERE organization_id = $1`, [
        organizationId,
      ]);
      await betterAuthPool.query(`DELETE FROM organization_roles WHERE organization_id = $1`, [
        organizationId,
      ]);
      await betterAuthPool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      await betterAuthPool.query(
        `DELETE FROM "session" WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`,
        [invitedEmail],
      );
      await betterAuthPool.query(
        `DELETE FROM "account" WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)`,
        [invitedEmail],
      );
      await betterAuthPool.query(`DELETE FROM "user" WHERE email = $1`, [invitedEmail]);
      await betterAuthPool.query(`DELETE FROM users WHERE email = $1`, [invitedEmail]);
    }
  });
});
