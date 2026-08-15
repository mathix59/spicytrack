import { createHmac, randomUUID } from "node:crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import { AppModule } from "../src/app.module";
import { AuthGuard } from "../src/auth/auth.guard";
import { IntegrationsService } from "../src/integrations/integrations.service";
import { type AuthenticatedRequest } from "../src/common/authenticated-request";
import { encryptSecret } from "../src/common/secrets";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import {
  auditLogs,
  organizationGithubAppRepositories,
  organizationGithubAppSettings,
  organizations,
} from "../src/database/schema";
import { OrganizationContextGuard } from "../src/rbac/organization-context.guard";
import { PermissionGuard } from "../src/rbac/permission.guard";

describe("GitHub App settings (e2e)", () => {
  let app: NestFastifyApplication;
  let db: DatabaseClient;
  let organizationId: string;
  let organizationSlug: string;
  let userId: string;
  let fetchMock: jest.Mock;
  const otherOrganizationId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/spicytrack";
    process.env.STORAGE_ENDPOINT ??= "http://localhost:9002";
    process.env.STORAGE_ACCESS_KEY_ID ??= "spicytrack";
    process.env.STORAGE_SECRET_ACCESS_KEY ??= "spicytrack-secret";
    process.env.APP_URL = "https://spicytrack.example";

    userId = randomUUID();
    const mockUser = {
      id: userId,
      email: "github-app-test@spicytrack.local",
    };
    const authGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        const request = context.switchToHttp().getRequest();
        request.auth = { user: mockUser as never };
        return true;
      },
    };
    const organizationGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        const request = context.switchToHttp().getRequest();
        request.organization = {
          organization: {
            id: organizationId,
            slug: organizationSlug,
            name: "GitHub App Test Org",
            status: "active",
            ownerUserId: mockUser.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never,
          membership: {
            id: randomUUID(),
            organizationId,
            userId: mockUser.id,
            role: "owner",
            invitedByUserId: null,
            joinedAt: new Date(),
          } as never,
        };
        return true;
      },
    };
    const permissionGuard = { canActivate: () => true };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(OrganizationContextGuard)
      .useValue(organizationGuard)
      .overrideGuard(PermissionGuard)
      .useValue(permissionGuard)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    db = app.get(DATABASE);
    const integrationsService = app.get(IntegrationsService) as unknown as {
      buildGithubAppJwt(appId: string, privateKey: string): string;
    };
    jest.spyOn(integrationsService, "buildGithubAppJwt").mockReturnValue("test-jwt");
    organizationId = randomUUID();
    organizationSlug = `github-app-org-${Date.now()}`;

    await db.insert(organizations).values({
      id: organizationId,
      name: "GitHub App Test Org",
      slug: organizationSlug,
      status: "active",
      ownerUserId: mockUser.id,
    });
    await db.insert(organizations).values({
      id: otherOrganizationId,
      name: "Other GitHub App Org",
      slug: `github-app-other-${Date.now()}`,
      status: "active",
      ownerUserId: mockUser.id,
    });

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(async () => {
    fetchMock.mockReset();
    await db
      .delete(organizationGithubAppRepositories)
      .where(eq(organizationGithubAppRepositories.organizationId, organizationId));
  });

  afterAll(async () => {
    if (db) {
      await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
      await db
        .delete(organizationGithubAppRepositories)
        .where(eq(organizationGithubAppRepositories.organizationId, organizationId));
      await db
        .delete(organizationGithubAppSettings)
        .where(eq(organizationGithubAppSettings.organizationId, organizationId));
      await db
        .delete(organizationGithubAppSettings)
        .where(eq(organizationGithubAppSettings.organizationId, otherOrganizationId));
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      await db.delete(organizations).where(eq(organizations.id, otherOrganizationId));
    }

    if (app) {
      await app.close();
    }
  });

  it("stores and returns masked GitHub App settings", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/organizations/${organizationSlug}/settings/github-app`,
      payload: {
        mode: "cloud",
        appSlug: "spicytrack-app",
        appId: "123456",
        clientId: "Iv1.test",
        clientSecret: "super-secret-client",
        privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
        webhookSecret: "webhook-secret",
      },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.appSlug).toBe("spicytrack-app");
    expect(payload.appId).toBe("123456");
    expect(payload.clientSecretSet).toBe(true);
    expect(payload.privateKeySet).toBe(true);
    expect(payload.webhookSecretSet).toBe(true);
    expect(payload.maskedClientSecret).toContain("supe");

    const audit = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId));
    const serializedAudit = JSON.stringify(audit);
    expect(serializedAudit).not.toContain("super-secret-client");
    expect(serializedAudit).not.toContain("webhook-secret");
    expect(serializedAudit).not.toContain("BEGIN PRIVATE KEY");
  });

  it("creates a preconfigured GitHub App manifest for personal or organization ownership", async () => {
    const personal = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/settings/github-app/manifest`,
      payload: {},
    });

    expect(personal.statusCode).toBe(201);
    expect(personal.json().action).toBe("https://github.com/settings/apps/new");
    expect(personal.json().state).toEqual(expect.any(String));
    expect(JSON.parse(personal.json().manifest)).toEqual(
      expect.objectContaining({
        url: "https://spicytrack.example",
        redirect_url: "https://spicytrack.example/github-app/setup",
        setup_url: "https://spicytrack.example/github-app/setup",
        public: false,
        hook_attributes: {
          url: "https://spicytrack.example/api/github-app/webhooks",
          active: true,
        },
        default_permissions: {
          contents: "write",
          metadata: "read",
          pull_requests: "write",
        },
        default_events: ["repository"],
      }),
    );

    const organization = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/settings/github-app/manifest`,
      payload: { githubOrganization: "acme corp" },
    });
    expect(organization.json().action).toBe(
      "https://github.com/organizations/acme%20corp/settings/apps/new",
    );
  });

  it("converts a GitHub manifest code and stores the generated credentials encrypted", async () => {
    const manifest = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/settings/github-app/manifest`,
      payload: {},
    });
    const { state } = manifest.json();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 123456,
        slug: "spicytrack-acme",
        client_id: "Iv1.generated",
        client_secret: "generated-client-secret",
        webhook_secret: "generated-webhook-secret",
        pem: "-----BEGIN PRIVATE KEY-----\ngenerated\n-----END PRIVATE KEY-----",
      }),
    );

    const response = await app.inject({
      method: "PUT",
      url: `/api/organizations/${organizationSlug}/settings/github-app/complete-manifest`,
      payload: { code: "one-time-code", state },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().installUrl).toBe(
      `https://github.com/apps/spicytrack-acme/installations/new?state=${encodeURIComponent(state)}`,
    );
    expect(response.json().settings).toEqual(
      expect.objectContaining({
        appId: "123456",
        appSlug: "spicytrack-acme",
        clientId: "Iv1.generated",
        clientSecretSet: true,
        privateKeySet: true,
        webhookSecretSet: true,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/app-manifests/one-time-code/conversions",
      expect.objectContaining({ method: "POST" }),
    );

    const [stored] = await db
      .select()
      .from(organizationGithubAppSettings)
      .where(eq(organizationGithubAppSettings.organizationId, organizationId));
    expect(stored.clientSecretCiphertext).not.toContain("generated-client-secret");
    expect(stored.webhookSecretCiphertext).not.toContain("generated-webhook-secret");
    expect(stored.privateKeyCiphertext).not.toContain("BEGIN PRIVATE KEY");
  });

  it("rejects a manifest callback with a tampered state", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/api/organizations/${organizationSlug}/settings/github-app/complete-manifest`,
      payload: { code: "one-time-code", state: "tampered" },
    });

    expect(response.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("completes the installation flow and syncs repositories", async () => {
    await app.inject({
      method: "PUT",
      url: `/api/organizations/${organizationSlug}/settings/github-app`,
      payload: {
        mode: "cloud",
        appSlug: "spicytrack-app",
        appId: "123456",
        privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
        webhookSecret: "webhook-secret",
      },
    });

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          id: 987,
          app_slug: "spicytrack-app",
          account: { login: "acme", type: "Organization" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ token: "inst_tok" }))
      .mockResolvedValueOnce(
        jsonResponse({
          repositories: [
            {
              id: 1001,
              full_name: "acme/spicytrack",
              default_branch: "main",
              private: true,
              archived: false,
              disabled: false,
            },
          ],
        }),
      );

    const response = await app.inject({
      method: "PUT",
      url: `/api/organizations/${organizationSlug}/settings/github-app/complete-installation`,
      payload: { installationId: "987" },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.installationId).toBe("987");
    expect(payload.installationAccountLogin).toBe("acme");
    expect(payload.installationAccountType).toBe("Organization");

    const listResponse = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/settings/github-app/repositories`,
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      {
        id: 1001,
        fullName: "acme/spicytrack",
        defaultBranch: "main",
        private: true,
        archived: false,
        disabled: false,
      },
    ]);
  });

  it("binds webhook verification to the payload installation tenant", async () => {
    await db.insert(organizationGithubAppSettings).values({
      organizationId: otherOrganizationId,
      mode: "cloud",
      installationId: "654321",
      webhookSecretCiphertext: encryptSecret("other-tenant-secret"),
    });
    const payload = JSON.stringify({ installation: { id: 654321 }, action: "noop" });
    const wrongSignature = `sha256=${createHmac("sha256", "webhook-secret").update(payload).digest("hex")}`;

    const confusedTenant = await app.inject({
      method: "POST",
      url: "/api/github-app/webhooks",
      headers: {
        "x-github-event": "ping",
        "x-hub-signature-256": wrongSignature,
        "content-type": "application/json",
      },
      payload,
    });
    expect(confusedTenant.statusCode).toBe(401);

    const validSignature = `sha256=${createHmac("sha256", "other-tenant-secret").update(payload).digest("hex")}`;
    const valid = await app.inject({
      method: "POST",
      url: "/api/github-app/webhooks",
      headers: {
        "x-github-event": "ping",
        "x-hub-signature-256": validSignature,
        "content-type": "application/json",
      },
      payload,
    });
    expect(valid.statusCode).toBe(201);

    const malformed = await app.inject({
      method: "POST",
      url: "/api/github-app/webhooks",
      headers: {
        "x-github-event": "installation",
        "x-hub-signature-256": validSignature,
        "content-type": "application/json",
      },
      payload: "{",
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("processes duplicate signed webhooks idempotently", async () => {
    const payload = JSON.stringify({ installation: { id: 987 }, ref: "refs/heads/main" });
    const signature = `sha256=${createHmac("sha256", "webhook-secret").update(payload).digest("hex")}`;
    for (let index = 0; index < 2; index += 1) {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ token: `installation-token-${index}` }))
        .mockResolvedValueOnce(
          jsonResponse({
            repositories: [
              {
                id: 1001,
                full_name: "acme/spicytrack",
                default_branch: "main",
                private: true,
                archived: false,
                disabled: false,
              },
            ],
          }),
        );
      const response = await app.inject({
        method: "POST",
        url: "/api/github-app/webhooks",
        headers: {
          "x-github-event": "push",
          "x-hub-signature-256": signature,
          "content-type": "application/json",
        },
        payload,
      });
      expect(response.statusCode).toBe(201);
    }

    const repositories = await db
      .select()
      .from(organizationGithubAppRepositories)
      .where(eq(organizationGithubAppRepositories.organizationId, organizationId));
    expect(repositories).toHaveLength(1);
  });
});

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
