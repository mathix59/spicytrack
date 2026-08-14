import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { and, eq, inArray } from "drizzle-orm";

import { AppModule } from "../src/app.module";
import { BetterAuthLifecycleService } from "../src/auth/better-auth-lifecycle.service";
import { betterAuthPool } from "../src/auth/better-auth";
import { AuthGuard } from "../src/auth/auth.guard";
import type { AuthenticatedRequest } from "../src/common/authenticated-request";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import {
  auditLogs,
  ingestRateCounters,
  issues,
  mcpCredentialProjects,
  mcpCredentials,
  organizationMcpSettings,
  organizations,
  projects,
} from "../src/database/schema";
import { OrganizationContextGuard } from "../src/rbac/organization-context.guard";
import { PermissionGuard } from "../src/rbac/permission.guard";

type JsonRpcResponse = { result?: Record<string, unknown>; error?: Record<string, unknown> };

function parseMcpResponse(response: {
  headers: Record<string, string | string[] | number | undefined>;
  body: string;
}) {
  const contentType = String(response.headers["content-type"] ?? "");
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(response.body) as JsonRpcResponse;
  }

  const data = response.body
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  if (!data) throw new Error(`MCP SSE response did not contain data: ${response.body}`);
  return JSON.parse(data) as JsonRpcResponse;
}

describe("MCP server (e2e)", () => {
  let app: NestFastifyApplication;
  let secondApp: NestFastifyApplication;
  let db: DatabaseClient;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const organizationSlug = `mcp-e2e-${Date.now()}`;
  const allowedProjectId = randomUUID();
  const blockedProjectId = randomUUID();
  const issueId = randomUUID();
  let key: string;

  const rpcOn = async (
    targetApp: NestFastifyApplication,
    token: string,
    body: Record<string, unknown>,
  ) => {
    const response = await targetApp.inject({
      method: "POST",
      url: "/api/mcp",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      payload: body,
    });
    return { response, body: parseMcpResponse(response) };
  };
  const rpc = (token: string, body: Record<string, unknown>) => rpcOn(app, token, body);

  const loadBalancedFetch: typeof fetch & { nextReplica: boolean } = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const webRequest = new Request(input, init);
      const url = new URL(webRequest.url);
      const target = loadBalancedFetch.nextReplica ? secondApp : app;
      loadBalancedFetch.nextReplica = !loadBalancedFetch.nextReplica;
      const rawBody = webRequest.method === "GET" ? undefined : await webRequest.text();
      const response = await target.inject({
        method: webRequest.method as "GET" | "POST" | "DELETE",
        url: `${url.pathname}${url.search}`,
        headers: Object.fromEntries(webRequest.headers.entries()),
        payload: rawBody,
      });
      return new Response(response.body, {
        status: response.statusCode,
        headers: response.headers as HeadersInit,
      });
    },
    { nextReplica: false },
  );

  const initialize = (id = 1) => ({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "spicytrack-e2e", version: "1.0.0" },
    },
  });

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/spicytrack";
    process.env.STORAGE_ENDPOINT ??= "http://localhost:9002";
    process.env.STORAGE_ACCESS_KEY_ID ??= "spicytrack";
    process.env.STORAGE_SECRET_ACCESS_KEY ??= "spicytrack-secret";

    const authGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        context.switchToHttp().getRequest().auth = {
          user: { id: userId, email: "mcp-e2e@spicytrack.local" } as never,
        };
        return true;
      },
    };
    const organizationGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        context.switchToHttp().getRequest().organization = {
          organization: {
            id: organizationId,
            slug: organizationSlug,
            name: "MCP E2E Org",
            status: "active",
            ownerUserId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never,
          membership: { organizationId, userId, role: "owner" } as never,
        };
        return true;
      },
    };

    const createApp = async () => {
      const fixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
        .overrideGuard(AuthGuard)
        .useValue(authGuard)
        .overrideGuard(OrganizationContextGuard)
        .useValue(organizationGuard)
        .overrideGuard(PermissionGuard)
        .useValue({ canActivate: () => true })
        .overrideProvider(BetterAuthLifecycleService)
        .useValue({ onApplicationShutdown: () => undefined })
        .compile();
      const instance = fixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      instance.setGlobalPrefix("api");
      await instance.init();
      await instance.getHttpAdapter().getInstance().ready();
      return instance;
    };

    app = await createApp();
    secondApp = await createApp();
    db = app.get(DATABASE);

    await db.insert(organizations).values({
      id: organizationId,
      name: "MCP E2E Org",
      slug: organizationSlug,
      ownerUserId: userId,
    });
    await db.insert(projects).values([
      { id: allowedProjectId, organizationId, name: "Allowed", slug: "allowed" },
      { id: blockedProjectId, organizationId, name: "Blocked", slug: "blocked" },
    ]);
    await db.insert(issues).values({
      id: issueId,
      organizationId,
      projectId: allowedProjectId,
      groupingKey: `mcp-e2e-${issueId}`,
      title: "MCP test issue",
    });
  });

  afterAll(async () => {
    if (db) {
      const credentialIds = await db
        .select({ id: mcpCredentials.id })
        .from(mcpCredentials)
        .where(eq(mcpCredentials.organizationId, organizationId));
      if (credentialIds.length > 0) {
        await db.delete(ingestRateCounters).where(
          inArray(
            ingestRateCounters.scopeId,
            credentialIds.map(({ id }) => id),
          ),
        );
      }
      await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
      await db.delete(mcpCredentialProjects);
      await db.delete(mcpCredentials).where(eq(mcpCredentials.organizationId, organizationId));
      await db
        .delete(organizationMcpSettings)
        .where(eq(organizationMcpSettings.organizationId, organizationId));
      await db.delete(issues).where(eq(issues.organizationId, organizationId));
      await db.delete(projects).where(eq(projects.organizationId, organizationId));
      await db.delete(organizations).where(eq(organizations.id, organizationId));
    }
    await app?.close();
    await secondApp?.close();
    await betterAuthPool.end();
  });

  it("requires a valid MCP key and an enabled organization", async () => {
    const unknown = await rpc("stp_mcp_unknown", initialize());
    expect(unknown.response.statusCode).toBe(401);

    const create = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/mcp/credentials`,
      payload: {
        name: "Scoped E2E key",
        scopes: ["projects:read", "issues:read", "issues:write"],
        allProjects: false,
        projectIds: [allowedProjectId],
      },
    });
    expect(create.statusCode).toBe(201);
    key = create.json().secret;

    const disabled = await rpc(key, initialize());
    expect(disabled.response.statusCode).toBe(401);

    const enable = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/mcp/settings`,
      payload: { enabled: true },
    });
    expect(enable.statusCode).toBe(200);

    const credential = (
      await app.inject({ method: "GET", url: `/api/organizations/${organizationSlug}/mcp` })
    )
      .json()
      .credentials.find((item: { tokenPreview: string }) => item.tokenPreview === key.slice(0, 16));
    const verification = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/mcp/credentials/${credential.id}/verify`,
    });
    expect(verification.statusCode).toBe(201);
    expect(verification.json()).toMatchObject({
      ready: true,
      checks: { serverEnabled: true, credentialActive: true, projectsAccessible: 1 },
    });
  });

  it("negotiates MCP and only exposes the key's scopes", async () => {
    const init = await rpc(key, initialize());
    expect(init.response.statusCode).toBe(200);
    expect(init.body.result?.serverInfo).toMatchObject({ name: "spicytrack" });

    const tools = await rpc(key, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    expect(tools.response.statusCode).toBe(200);
    const names = ((tools.body.result?.tools ?? []) as Array<{ name: string }>).map(
      (tool) => tool.name,
    );
    expect(names).toEqual(
      expect.arrayContaining(["list_projects", "list_issues", "get_issue", "update_issue"]),
    );
    expect(names).not.toContain("get_event");
    expect(names).not.toContain("run_autofix");
  });

  it("serves the stateless 2026 protocol across alternating replicas", async () => {
    const client = new Client(
      { name: "spicytrack-modern-e2e", version: "1.0.0" },
      { versionNegotiation: { mode: "auto" } },
    );
    const transport = new StreamableHTTPClientTransport(new URL("http://spicytrack.test/api/mcp"), {
      fetch: loadBalancedFetch,
      requestInit: { headers: { authorization: `Bearer ${key}` } },
    });
    try {
      await client.connect(transport);
      expect(client.getProtocolEra()).toBe("modern");
      const result = await client.listTools();
      expect(result.tools.map(({ name }) => name)).toEqual(
        expect.arrayContaining(["list_projects", "list_issues", "update_issue"]),
      );
    } finally {
      await client.close();
    }
  });

  it("enforces the project allowlist and records successful tool calls", async () => {
    const projectsResult = await rpc(key, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "list_projects", arguments: {} },
    });
    expect(projectsResult.response.statusCode).toBe(200);
    const text = ((projectsResult.body.result?.content ?? []) as Array<{ text: string }>)[0]?.text;
    expect(JSON.parse(text ?? "[]")).toEqual([expect.objectContaining({ id: allowedProjectId })]);

    const denied = await rpc(key, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "list_issues", arguments: { projectId: blockedProjectId } },
    });
    expect(denied.response.statusCode).toBe(200);
    expect(denied.body.result?.isError).toBe(true);

    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(
        and(eq(auditLogs.organizationId, organizationId), eq(auditLogs.action, "mcp.tool.called")),
      );
    expect(audit?.payload).toMatchObject({ tool: "list_projects", status: "success" });
  });

  it("requires confirmation before it executes a scoped write", async () => {
    const unconfirmed = await rpc(key, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "update_issue",
        arguments: { projectId: allowedProjectId, issueId, status: "resolved" },
      },
    });
    expect(unconfirmed.body.result?.isError).toBe(true);

    const update = await rpc(key, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "update_issue",
        arguments: {
          projectId: allowedProjectId,
          issueId,
          status: "resolved",
          priority: "high",
          confirmed: true,
        },
      },
    });
    expect(update.body.result?.isError).not.toBe(true);
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
    expect(issue).toMatchObject({ status: "resolved", priority: "high" });

    const invalid = await rpc(key, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "update_issue", arguments: { projectId: allowedProjectId, issueId } },
    });
    expect(invalid.body.result?.isError).toBe(true);
  });

  it("invalidates a revoked key and accepts the rotated replacement", async () => {
    const credential = (
      await app.inject({ method: "GET", url: `/api/organizations/${organizationSlug}/mcp` })
    )
      .json()
      .credentials.find((item: { tokenPreview: string }) => item.tokenPreview === key.slice(0, 16));
    const rotate = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/mcp/credentials/${credential.id}/rotate`,
    });
    expect(rotate.statusCode).toBe(201);
    const replacement = rotate.json().secret as string;

    expect((await rpc(key, initialize(7))).response.statusCode).toBe(401);
    expect((await rpc(replacement, initialize(8))).response.statusCode).toBe(200);
  });

  it("enforces scopes even when a client calls a hidden write tool directly", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/mcp/credentials`,
      payload: {
        name: "Read-only key",
        scopes: ["projects:read", "issues:read"],
        allProjects: true,
        projectIds: [],
      },
    });
    const readOnlyKey = create.json().secret as string;
    const tools = await rpc(readOnlyKey, {
      jsonrpc: "2.0",
      id: 20,
      method: "tools/list",
      params: {},
    });
    const names = ((tools.body.result?.tools ?? []) as Array<{ name: string }>).map(
      ({ name }) => name,
    );
    expect(names).not.toContain("update_issue");

    const forcedWrite = await rpc(readOnlyKey, {
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: {
        name: "update_issue",
        arguments: { projectId: allowedProjectId, issueId, status: "resolved", confirmed: true },
      },
    });
    expect(forcedWrite.body.result?.isError ?? forcedWrite.body.error).toBeTruthy();
  });

  it("rejects an expired credential immediately", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/mcp/credentials`,
      payload: {
        name: "Expiring key",
        scopes: ["projects:read"],
        allProjects: true,
        projectIds: [],
      },
    });
    const secret = create.json().secret as string;
    const credential = (
      await db
        .select()
        .from(mcpCredentials)
        .where(eq(mcpCredentials.organizationId, organizationId))
    ).find(({ tokenPreview }) => tokenPreview === secret.slice(0, 16))!;
    await db
      .update(mcpCredentials)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(mcpCredentials.id, credential.id));
    expect((await rpc(secret, initialize(30))).response.statusCode).toBe(401);
  });

  it("shares rate limits across independent API instances", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/mcp/credentials`,
      payload: {
        name: "Distributed rate key",
        scopes: ["projects:read"],
        allProjects: true,
        projectIds: [],
      },
    });
    const secret = create.json().secret as string;
    for (let index = 0; index < 30; index += 1) {
      expect((await rpcOn(app, secret, initialize(100 + index))).response.statusCode).toBe(200);
    }
    for (let index = 0; index < 30; index += 1) {
      expect((await rpcOn(secondApp, secret, initialize(200 + index))).response.statusCode).toBe(
        200,
      );
    }
    expect((await rpcOn(secondApp, secret, initialize(300))).response.statusCode).toBe(429);
  });
});
