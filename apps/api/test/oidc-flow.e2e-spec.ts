import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Test } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { fromNodeHeaders } from "better-auth/node";

const ORIGIN = process.env.WEB_ORIGIN?.split(",")[0] ?? "http://localhost:5174";

function cookieHeader(value: string | string[] | undefined): string {
  const values = Array.isArray(value) ? value : [value ?? ""];
  return values
    .filter(Boolean)
    .map((header) => header.split(";")[0])
    .join("; ");
}

describe("Generic OAuth flow (e2e)", () => {
  let app: NestFastifyApplication;
  let provider: Server;
  let pool: import("pg").Pool;
  let issuer: string;
  const email = `oidc-flow-${Date.now()}@example.test`;
  const existingEmail = `oidc-existing-${Date.now()}@example.test`;
  const existingUserId = "10000000-0000-4000-8000-000000000003";
  let providerEmail = email;
  let providerSubject = "fake-provider-user";
  const organizationId = "10000000-0000-4000-8000-000000000001";
  const ownerUserId = "10000000-0000-4000-8000-000000000002";

  beforeAll(async () => {
    provider = createServer((request, response) => {
      const path = new URL(request.url ?? "/", issuer).pathname;
      response.setHeader("content-type", "application/json");
      if (path === "/.well-known/openid-configuration") {
        response.end(
          JSON.stringify({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            userinfo_endpoint: `${issuer}/userinfo`,
          }),
        );
        return;
      }
      if (path === "/token") {
        response.end(JSON.stringify({ access_token: "fake-access-token", token_type: "Bearer" }));
        return;
      }
      if (path === "/userinfo") {
        response.end(
          JSON.stringify({
            sub: providerSubject,
            email: providerEmail,
            email_verified: true,
            name: "OIDC Flow E2E",
          }),
        );
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not_found" }));
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    issuer = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;

    process.env.OIDC_DISCOVERY_URL = `${issuer}/.well-known/openid-configuration`;
    process.env.OIDC_CLIENT_ID = "spicytrack-e2e";
    process.env.OIDC_CLIENT_SECRET = "spicytrack-e2e-secret";
    process.env.OIDC_PROVIDER_ID = "fake-oidc";
    process.env.OIDC_AUTO_JOIN_ORGANIZATION_SLUG = "oidc-e2e";
    process.env.OIDC_AUTO_JOIN_EMAIL_DOMAINS = "example.test";
    process.env.OIDC_ACCESS_MODE = "open";

    const { AppModule } =
      jest.requireActual<typeof import("../src/app.module.js")>("../src/app.module");
    const auth =
      jest.requireActual<typeof import("../src/auth/better-auth.js")>("../src/auth/better-auth");
    pool = auth.betterAuthPool;
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name)
       VALUES ($1, 'oidc-owner@example.test', '', 'OIDC Test Owner')
       ON CONFLICT (id) DO NOTHING`,
      [ownerUserId],
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_user_id)
       VALUES ($1, 'OIDC E2E', 'oidc-e2e', $2)
       ON CONFLICT (id) DO NOTHING`,
      [organizationId, ownerUserId],
    );

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    app
      .getHttpAdapter()
      .getInstance()
      .all("/api/better-auth/*", async (request, reply) => {
        const url = new URL(request.url, `http://${request.headers.host}`);
        const authRequest = new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        });
        const authResponse = await auth.handleBetterAuthRequest(authRequest);
        reply.status(authResponse.status);
        authResponse.headers.forEach((value: string, key: string) => reply.header(key, value));
        return reply.send(authResponse.body ? await authResponse.text() : undefined);
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        `DELETE FROM "session" WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1))`,
        [[email, existingEmail]],
      );
      await pool.query(
        `DELETE FROM "account" WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY($1))`,
        [[email, existingEmail]],
      );
      await pool.query(`DELETE FROM audit_logs WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM "user" WHERE email = ANY($1)`, [[email, existingEmail]]);
      await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [[email, existingEmail]]);
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [ownerUserId]);
    }
    if (app) await app.close();
    if (provider)
      await new Promise<void>((resolve, reject) =>
        provider.close((error) => (error ? reject(error) : resolve())),
      );
    delete process.env.OIDC_ACCESS_MODE;
  });

  it("discovers the provider, completes the callback, and auto-joins the configured organization", async () => {
    const start = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/oauth2",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { providerId: "fake-oidc", callbackURL: `${ORIGIN}/app`, disableRedirect: true },
    });
    expect(start.statusCode).toBe(200);
    const authorizationUrl = new URL(start.json().url);
    expect(authorizationUrl.origin).toBe(issuer);
    expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();

    const callback = await app.inject({
      method: "GET",
      url: `/api/better-auth/oauth2/callback/fake-oidc?code=fake-code&state=${encodeURIComponent(authorizationUrl.searchParams.get("state") ?? "")}&iss=${encodeURIComponent(issuer)}`,
      headers: { origin: ORIGIN, cookie: cookieHeader(start.headers["set-cookie"]) },
    });
    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe(`${ORIGIN}/app`);

    const membership = await pool.query(
      `SELECT om.role FROM organization_members om JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1 AND u.email = $2`,
      [organizationId, email],
    );
    expect(membership.rows).toEqual([{ role: "member" }]);
    const audit = await pool.query(
      `SELECT action FROM audit_logs WHERE organization_id = $1 AND action = 'auth.sso_login'`,
      [organizationId],
    );
    expect(audit.rows).toEqual([{ action: "auth.sso_login" }]);
  });

  it("links a verified OIDC identity to an existing account without duplicating the user", async () => {
    providerEmail = existingEmail;
    providerSubject = "existing-provider-user";
    await pool.query(
      `INSERT INTO "user" (id, email, email_verified, name, created_at, updated_at)
       VALUES ($1, $2, true, 'Existing OIDC User', NOW(), NOW())`,
      [existingUserId, existingEmail],
    );
    await pool.query(
      `INSERT INTO users (id, email, password_hash, email_verified_at, name)
       VALUES ($1, $2, '', NOW(), 'Existing OIDC User')`,
      [existingUserId, existingEmail],
    );

    const start = await app.inject({
      method: "POST",
      url: "/api/better-auth/sign-in/oauth2",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      payload: { providerId: "fake-oidc", callbackURL: `${ORIGIN}/app`, disableRedirect: true },
    });
    expect(start.statusCode).toBe(200);
    const authorizationUrl = new URL(start.json().url);
    const callback = await app.inject({
      method: "GET",
      url: `/api/better-auth/oauth2/callback/fake-oidc?code=fake-code&state=${encodeURIComponent(authorizationUrl.searchParams.get("state") ?? "")}&iss=${encodeURIComponent(issuer)}`,
      headers: { origin: ORIGIN, cookie: cookieHeader(start.headers["set-cookie"]) },
    });
    expect(callback.statusCode).toBe(302);

    const users = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [existingEmail]);
    const appUsers = await pool.query(`SELECT id FROM users WHERE email = $1`, [existingEmail]);
    const accounts = await pool.query(
      `SELECT user_id FROM "account" WHERE provider_id = 'fake-oidc' AND account_id = $1`,
      [providerSubject],
    );
    expect(users.rows).toEqual([{ id: existingUserId }]);
    expect(appUsers.rows).toEqual([{ id: existingUserId }]);
    expect(accounts.rows).toEqual([{ user_id: existingUserId }]);
  });
});
