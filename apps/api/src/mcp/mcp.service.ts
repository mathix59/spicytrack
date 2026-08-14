import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createMcpHandler, Server } from "@modelcontextprotocol/server";
import { toWebRequest } from "@modelcontextprotocol/node";
import { and, desc, eq, ilike, inArray, isNull, like, sql } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";

import { AuditService } from "../audit/audit.service";
import { AutofixService } from "../autofix/autofix.service";
import { redactEventPayload } from "../common/event-payload-redaction";
import { hashOpaqueToken, generateOpaqueToken } from "../common/tokens";
import { DATABASE, primaryDatabase } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  autofixRuns,
  auditLogs,
  events,
  ingestRateCounters,
  issues,
  mcpCredentialProjects,
  mcpCredentials,
  organizationMcpSettings,
  projects,
  releases,
} from "../database/schema";
import { IssuesService } from "../issues/issues.service";
import type { McpScope } from "./mcp.types";

const MCP_TOKEN_PREFIX = "stp_mcp";
const MCP_REQUESTS_PER_MINUTE = 60;

type McpCredentialRecord = typeof mcpCredentials.$inferSelect;
type McpToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };
type McpTool = {
  name: string;
  description: string;
  inputSchema: { type: "object"; [key: string]: unknown };
  readOnly: boolean;
  execute: (args: Record<string, unknown>) => Promise<McpToolResult>;
};

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

@Injectable()
export class McpService {
  private readonly db: DatabaseClient;

  constructor(
    @Inject(DATABASE) database: DatabaseClient,
    private readonly auditService: AuditService,
    private readonly issuesService: IssuesService,
    private readonly autofixService: AutofixService,
  ) {
    this.db = primaryDatabase(database);
  }

  async getSettings(organizationId: string) {
    const [settings] = await this.db
      .select({ enabled: organizationMcpSettings.enabled })
      .from(organizationMcpSettings)
      .where(eq(organizationMcpSettings.organizationId, organizationId))
      .limit(1);

    return { endpoint: "/api/mcp", enabled: settings?.enabled ?? false };
  }

  async updateSettings(input: { organizationId: string; actorUserId: string; enabled: boolean }) {
    const [settings] = await this.db
      .insert(organizationMcpSettings)
      .values({
        organizationId: input.organizationId,
        enabled: input.enabled,
        updatedByUserId: input.actorUserId,
      })
      .onConflictDoUpdate({
        target: organizationMcpSettings.organizationId,
        set: { enabled: input.enabled, updatedByUserId: input.actorUserId, updatedAt: new Date() },
      })
      .returning({ enabled: organizationMcpSettings.enabled });

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: input.enabled ? "mcp.enabled" : "mcp.disabled",
      targetType: "organization_mcp_settings",
      payload: {},
    });

    return { endpoint: "/api/mcp", enabled: settings.enabled };
  }

  async listCredentials(organizationId: string) {
    const credentials = await this.db
      .select({
        id: mcpCredentials.id,
        name: mcpCredentials.name,
        tokenPreview: mcpCredentials.tokenPreview,
        scopes: mcpCredentials.scopes,
        allProjects: mcpCredentials.allProjects,
        expiresAt: mcpCredentials.expiresAt,
        lastUsedAt: mcpCredentials.lastUsedAt,
        revokedAt: mcpCredentials.revokedAt,
        createdAt: mcpCredentials.createdAt,
      })
      .from(mcpCredentials)
      .where(eq(mcpCredentials.organizationId, organizationId))
      .orderBy(desc(mcpCredentials.createdAt));

    const ids = credentials.map((credential) => credential.id);
    const grants = ids.length
      ? await this.db
          .select({
            credentialId: mcpCredentialProjects.credentialId,
            projectId: mcpCredentialProjects.projectId,
          })
          .from(mcpCredentialProjects)
          .where(inArray(mcpCredentialProjects.credentialId, ids))
      : [];

    return credentials.map((credential) => ({
      ...credential,
      scopes: credential.scopes as McpScope[],
      projectIds: grants
        .filter((grant) => grant.credentialId === credential.id)
        .map((grant) => grant.projectId),
    }));
  }

  async listActivity(organizationId: string) {
    return this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        payload: auditLogs.payload,
        projectId: auditLogs.projectId,
        createdAt: auditLogs.createdAt,
        credentialId: mcpCredentials.id,
        credentialName: mcpCredentials.name,
      })
      .from(auditLogs)
      .leftJoin(mcpCredentials, eq(auditLogs.targetId, mcpCredentials.id))
      .where(and(eq(auditLogs.organizationId, organizationId), like(auditLogs.action, "mcp.%")))
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);
  }

  async verifyCredential(input: { organizationId: string; credentialId: string }) {
    const [credential] = await this.db
      .select({
        id: mcpCredentials.id,
        name: mcpCredentials.name,
        allProjects: mcpCredentials.allProjects,
        scopes: mcpCredentials.scopes,
        revokedAt: mcpCredentials.revokedAt,
        expiresAt: mcpCredentials.expiresAt,
      })
      .from(mcpCredentials)
      .where(
        and(
          eq(mcpCredentials.id, input.credentialId),
          eq(mcpCredentials.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!credential) throw new NotFoundException("MCP credential not found");

    const [settings] = await this.db
      .select({ enabled: organizationMcpSettings.enabled })
      .from(organizationMcpSettings)
      .where(eq(organizationMcpSettings.organizationId, input.organizationId))
      .limit(1);
    const projectIds = credential.allProjects
      ? await this.db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.organizationId, input.organizationId))
      : await this.db
          .select({ id: mcpCredentialProjects.projectId })
          .from(mcpCredentialProjects)
          .where(eq(mcpCredentialProjects.credentialId, credential.id));
    const expired = Boolean(credential.expiresAt && credential.expiresAt <= new Date());
    return {
      ready: Boolean(settings?.enabled && !credential.revokedAt && !expired),
      endpoint: "/api/mcp",
      checks: {
        serverEnabled: Boolean(settings?.enabled),
        credentialActive: !credential.revokedAt && !expired,
        projectsAccessible: projectIds.length,
      },
      credential: { ...credential, scopes: credential.scopes as McpScope[] },
    };
  }

  async createCredential(input: {
    organizationId: string;
    actorUserId: string;
    name: string;
    scopes: McpScope[];
    allProjects: boolean;
    projectIds: string[];
    expiresInDays?: number;
  }) {
    if (!input.allProjects && input.projectIds.length === 0) {
      throw new ForbiddenException("Select at least one project or allow all projects");
    }

    await this.assertProjectsBelongToOrganization(input.organizationId, input.projectIds);

    const { token, hash } = generateOpaqueToken(MCP_TOKEN_PREFIX);
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    const [credential] = await this.db
      .insert(mcpCredentials)
      .values({
        organizationId: input.organizationId,
        createdByUserId: input.actorUserId,
        name: input.name,
        tokenHash: hash,
        tokenPreview: token.slice(0, 16),
        scopes: input.scopes,
        allProjects: input.allProjects,
        expiresAt,
      })
      .returning();

    if (!input.allProjects) {
      await this.db
        .insert(mcpCredentialProjects)
        .values(input.projectIds.map((projectId) => ({ credentialId: credential.id, projectId })));
    }

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "mcp.credential.created",
      targetType: "mcp_credential",
      targetId: credential.id,
      payload: { name: credential.name, scopes: input.scopes, allProjects: input.allProjects },
    });

    return {
      credential: {
        ...credential,
        scopes: credential.scopes as McpScope[],
        projectIds: input.projectIds,
      },
      secret: token,
    };
  }

  async revokeCredential(input: {
    organizationId: string;
    actorUserId: string;
    credentialId: string;
  }) {
    const [credential] = await this.db
      .update(mcpCredentials)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(mcpCredentials.id, input.credentialId),
          eq(mcpCredentials.organizationId, input.organizationId),
          isNull(mcpCredentials.revokedAt),
        ),
      )
      .returning({ id: mcpCredentials.id });
    if (!credential) throw new NotFoundException("MCP credential not found");

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "mcp.credential.revoked",
      targetType: "mcp_credential",
      targetId: credential.id,
      payload: {},
    });

    return { success: true };
  }

  async rotateCredential(input: {
    organizationId: string;
    actorUserId: string;
    credentialId: string;
  }) {
    const [current] = await this.db
      .select()
      .from(mcpCredentials)
      .where(
        and(
          eq(mcpCredentials.id, input.credentialId),
          eq(mcpCredentials.organizationId, input.organizationId),
          isNull(mcpCredentials.revokedAt),
        ),
      )
      .limit(1);
    if (!current) throw new NotFoundException("MCP credential not found");

    const result = await this.createCredential({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      name: `${current.name} (rotated)`,
      scopes: current.scopes as McpScope[],
      allProjects: current.allProjects,
      projectIds: current.allProjects ? [] : ((await this.allowedProjectIds(current)) ?? []),
      expiresInDays: current.expiresAt
        ? Math.max(1, Math.ceil((current.expiresAt.getTime() - Date.now()) / 86_400_000))
        : undefined,
    });
    await this.revokeCredential({ ...input, credentialId: current.id });
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "mcp.credential.rotated",
      targetType: "mcp_credential",
      targetId: result.credential.id,
      payload: { previousCredentialId: current.id },
    });
    return result;
  }

  async handleHttpRequest(request: FastifyRequest, reply: FastifyReply) {
    const token = request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice("Bearer ".length).trim()
      : "";
    const credential = await this.authenticate(token);
    const handler = createMcpHandler(() => this.createServer(credential), {
      legacy: "stateless",
    });

    try {
      const webRequest = await toWebRequest(request.raw, request.body);
      const response = await handler.fetch(webRequest, { parsedBody: request.body });
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : undefined);
    } finally {
      await handler.close();
    }
  }

  private async authenticate(token: string): Promise<McpCredentialRecord> {
    if (!token.startsWith(`${MCP_TOKEN_PREFIX}_`)) {
      throw new UnauthorizedException("Missing or invalid MCP credentials");
    }
    const [credential] = await this.db
      .select()
      .from(mcpCredentials)
      .where(eq(mcpCredentials.tokenHash, hashOpaqueToken(token)))
      .limit(1);
    if (
      !credential ||
      credential.revokedAt ||
      (credential.expiresAt && credential.expiresAt <= new Date())
    ) {
      throw new UnauthorizedException("MCP credential is invalid or expired");
    }
    const [settings] = await this.db
      .select({ enabled: organizationMcpSettings.enabled })
      .from(organizationMcpSettings)
      .where(eq(organizationMcpSettings.organizationId, credential.organizationId))
      .limit(1);
    if (!settings?.enabled)
      throw new UnauthorizedException("MCP is disabled for this organization");

    await this.assertWithinRateLimit(credential.id);

    await this.db
      .update(mcpCredentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(mcpCredentials.id, credential.id));
    return credential;
  }

  private createServer(credential: McpCredentialRecord) {
    const server = new Server(
      { name: "spicytrack", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    const scopes = new Set(credential.scopes as McpScope[]);
    const can = (scope: McpScope) => scopes.has(scope);
    const run = async (tool: string, callback: () => Promise<unknown>) => {
      try {
        const result = await callback();
        await this.auditService.record({
          organizationId: credential.organizationId,
          action: "mcp.tool.called",
          targetType: "mcp_credential",
          targetId: credential.id,
          payload: { tool, status: "success" },
        });
        return jsonResult(result);
      } catch (error) {
        await this.auditService.record({
          organizationId: credential.organizationId,
          action: "mcp.tool.called",
          targetType: "mcp_credential",
          targetId: credential.id,
          payload: { tool, status: "error" },
        });
        throw error;
      }
    };
    const tools: McpTool[] = [];
    const add = (tool: McpTool) => tools.push(tool);

    if (can("projects:read")) {
      add({
        name: "list_projects",
        description: "List projects this MCP credential may access.",
        inputSchema: { type: "object", additionalProperties: false },
        readOnly: true,
        execute: () => run("list_projects", () => this.listAllowedProjects(credential)),
      });
    }
    if (can("issues:read")) {
      add({
        name: "list_issues",
        description: "List recent issues in an allowed project.",
        inputSchema: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            page: { type: "integer", minimum: 1, maximum: 1000 },
            pageSize: { type: "integer", minimum: 1, maximum: 100 },
            status: { type: "string", maxLength: 32 },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            query: { type: "string", minLength: 1, maxLength: 120 },
          },
          additionalProperties: false,
        },
        readOnly: true,
        execute: (args) => {
          const projectId = this.uuidArg(args, "projectId");
          return run("list_issues", () =>
            this.listIssues(credential, {
              projectId,
              page: this.numberArg(args, "page", 1, 1, 1000),
              pageSize: this.numberArg(args, "pageSize", 25, 1, 100),
              status: this.optionalStringArg(args, "status", 32),
              priority: this.optionalOneOfArg(args, "priority", [
                "low",
                "medium",
                "high",
                "critical",
              ]),
              query: this.optionalStringArg(args, "query", 120),
            }),
          );
        },
      });
      add({
        name: "get_issue",
        description: "Get one issue from an allowed project.",
        inputSchema: {
          type: "object",
          required: ["projectId", "issueId"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            issueId: { type: "string", format: "uuid" },
          },
          additionalProperties: false,
        },
        readOnly: true,
        execute: (args) =>
          run("get_issue", () =>
            this.getIssue(
              credential,
              this.uuidArg(args, "projectId"),
              this.uuidArg(args, "issueId"),
            ),
          ),
      });
    }
    if (can("events:read")) {
      add({
        name: "list_issue_events",
        description:
          "List recent event summaries for an issue in an allowed project. Payloads are not returned.",
        inputSchema: {
          type: "object",
          required: ["projectId", "issueId"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            issueId: { type: "string", format: "uuid" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        readOnly: true,
        execute: (args) =>
          run("list_issue_events", () =>
            this.listIssueEvents(
              credential,
              this.uuidArg(args, "projectId"),
              this.uuidArg(args, "issueId"),
              this.numberArg(args, "limit", 25, 1, 100),
            ),
          ),
      });
      add({
        name: "get_event",
        description: "Get a redacted event payload from an allowed project.",
        inputSchema: {
          type: "object",
          required: ["projectId", "eventId"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            eventId: { type: "string", format: "uuid" },
          },
          additionalProperties: false,
        },
        readOnly: true,
        execute: (args) =>
          run("get_event", () =>
            this.getEvent(
              credential,
              this.uuidArg(args, "projectId"),
              this.uuidArg(args, "eventId"),
            ),
          ),
      });
    }
    if (can("releases:read")) {
      add({
        name: "list_releases",
        description: "List releases for an allowed project.",
        inputSchema: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        readOnly: true,
        execute: (args) =>
          run("list_releases", () =>
            this.listReleases(
              credential,
              this.uuidArg(args, "projectId"),
              this.numberArg(args, "limit", 25, 1, 100),
            ),
          ),
      });
    }
    if (can("autofix:read")) {
      add({
        name: "list_autofix_runs",
        description: "List Autofix runs for an allowed project.",
        inputSchema: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        readOnly: true,
        execute: (args) =>
          run("list_autofix_runs", () =>
            this.listAutofixRuns(
              credential,
              this.uuidArg(args, "projectId"),
              this.numberArg(args, "limit", 25, 1, 100),
            ),
          ),
      });
    }
    if (can("issues:write")) {
      add({
        name: "update_issue",
        description:
          "Update an issue status or priority. Use only after confirming the intended change.",
        inputSchema: {
          type: "object",
          required: ["projectId", "issueId", "confirmed"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            issueId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["open", "resolved", "ignored"] },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            confirmed: {
              type: "boolean",
              const: true,
              description: "Must be true after the user explicitly confirms this change.",
            },
          },
          additionalProperties: false,
        },
        readOnly: false,
        execute: (args) =>
          run("update_issue", () =>
            this.updateIssue(credential, {
              projectId: this.uuidArg(args, "projectId"),
              issueId: this.uuidArg(args, "issueId"),
              status: this.optionalOneOfArg(args, "status", ["open", "resolved", "ignored"]),
              priority: this.optionalOneOfArg(args, "priority", [
                "low",
                "medium",
                "high",
                "critical",
              ]),
              confirmed: this.confirmedArg(args),
            }),
          ),
      });
    }
    if (can("comments:write")) {
      add({
        name: "create_issue_comment",
        description:
          "Add a comment to an issue. The comment is attributed to the member who created this MCP key, with the MCP credential retained in the audit log.",
        inputSchema: {
          type: "object",
          required: ["projectId", "issueId", "body", "confirmed"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            issueId: { type: "string", format: "uuid" },
            body: { type: "string", minLength: 1, maxLength: 5000 },
            confirmed: {
              type: "boolean",
              const: true,
              description: "Must be true after the user explicitly confirms this action.",
            },
          },
          additionalProperties: false,
        },
        readOnly: false,
        execute: (args) =>
          run("create_issue_comment", () =>
            this.createIssueComment(
              credential,
              this.uuidArg(args, "projectId"),
              this.uuidArg(args, "issueId"),
              this.stringArg(args, "body", 5000),
              this.confirmedArg(args),
            ),
          ),
      });
    }
    if (can("autofix:run")) {
      add({
        name: "run_autofix",
        description:
          "Start a new Autofix investigation for an issue. This consumes AI provider capacity and may create a branch or pull request.",
        inputSchema: {
          type: "object",
          required: ["projectId", "issueId", "confirmed"],
          properties: {
            projectId: { type: "string", format: "uuid" },
            issueId: { type: "string", format: "uuid" },
            confirmed: {
              type: "boolean",
              const: true,
              description: "Must be true after the user explicitly confirms this AI run.",
            },
          },
          additionalProperties: false,
        },
        readOnly: false,
        execute: (args) =>
          run("run_autofix", () =>
            this.runAutofix(
              credential,
              this.uuidArg(args, "projectId"),
              this.uuidArg(args, "issueId"),
              this.confirmedArg(args),
            ),
          ),
      });
    }

    server.setRequestHandler("tools/list", async () => ({
      tools: tools.map(({ name, description, inputSchema, readOnly }) => ({
        name,
        description,
        inputSchema,
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly },
      })),
    }));
    server.setRequestHandler("tools/call", async (request) => {
      const tool = tools.find((candidate) => candidate.name === request.params.name);
      if (!tool)
        return {
          content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
          isError: true,
        };
      try {
        return await tool.execute((request.params.arguments ?? {}) as Record<string, unknown>);
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : "Tool failed" }],
          isError: true,
        };
      }
    });
    return server;
  }

  private uuidArg(args: Record<string, unknown>, name: string) {
    const value = args[name];
    if (
      typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
      throw new ForbiddenException(`${name} must be a UUID`);
    }
    return value;
  }

  private numberArg(
    args: Record<string, unknown>,
    name: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const value = args[name];
    if (value === undefined) return fallback;
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
      throw new ForbiddenException(`${name} must be an integer between ${min} and ${max}`);
    return value;
  }

  private optionalStringArg(args: Record<string, unknown>, name: string, maxLength: number) {
    const value = args[name];
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.length > maxLength)
      throw new ForbiddenException(`${name} must be a string up to ${maxLength} characters`);
    return value;
  }

  private stringArg(args: Record<string, unknown>, name: string, maxLength: number) {
    const value = this.optionalStringArg(args, name, maxLength)?.trim();
    if (!value) throw new ForbiddenException(`${name} is required`);
    return value;
  }

  private optionalOneOfArg<T extends string>(
    args: Record<string, unknown>,
    name: string,
    options: readonly T[],
  ): T | undefined {
    const value = args[name];
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !options.includes(value as T)) {
      throw new ForbiddenException(`${name} must be one of: ${options.join(", ")}`);
    }
    return value as T;
  }

  private confirmedArg(args: Record<string, unknown>) {
    if (args.confirmed !== true) {
      throw new ForbiddenException("Set confirmed to true after explicit user confirmation");
    }
    return true as const;
  }

  private async listAllowedProjects(credential: McpCredentialRecord) {
    const allowedIds = await this.allowedProjectIds(credential);
    return this.db
      .select({
        id: projects.id,
        publicId: projects.publicId,
        name: projects.name,
        slug: projects.slug,
        platform: projects.platform,
        status: projects.status,
      })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, credential.organizationId),
          ...(allowedIds ? [inArray(projects.id, allowedIds)] : []),
        ),
      )
      .orderBy(projects.name);
  }

  private async listIssues(
    credential: McpCredentialRecord,
    input: {
      projectId: string;
      page: number;
      pageSize: number;
      status?: string;
      priority?: "low" | "medium" | "high" | "critical";
      query?: string;
    },
  ) {
    await this.assertAllowedProject(credential, input.projectId);
    const where = and(
      eq(issues.projectId, input.projectId),
      ...(input.status ? [eq(issues.status, input.status)] : []),
      ...(input.priority ? [eq(issues.priority, input.priority)] : []),
      ...(input.query ? [ilike(issues.title, `%${input.query.trim()}%`)] : []),
    );
    const items = await this.db
      .select()
      .from(issues)
      .where(where)
      .orderBy(desc(issues.lastSeenAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    return { items, page: input.page, pageSize: input.pageSize };
  }

  private async listIssueEvents(
    credential: McpCredentialRecord,
    projectId: string,
    issueId: string,
    limit: number,
  ) {
    await this.assertAllowedProject(credential, projectId);
    const [issue] = await this.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");
    return this.db
      .select({
        id: events.id,
        eventId: events.eventId,
        level: events.level,
        message: events.message,
        transactionName: events.transactionName,
        timestamp: events.timestamp,
        releaseId: events.releaseId,
        environmentId: events.environmentId,
      })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.issueId, issueId)))
      .orderBy(desc(events.timestamp))
      .limit(limit);
  }

  private async getIssue(credential: McpCredentialRecord, projectId: string, issueId: string) {
    await this.assertAllowedProject(credential, projectId);
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.id, issueId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");
    return issue;
  }

  private async getEvent(credential: McpCredentialRecord, projectId: string, eventId: string) {
    await this.assertAllowedProject(credential, projectId);
    const [event] = await this.db
      .select()
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.id, eventId)))
      .limit(1);
    if (!event) throw new NotFoundException("Event not found");
    return {
      ...event,
      rawPayload: redactEventPayload(event.rawPayload as Record<string, unknown>),
    };
  }

  private async listReleases(credential: McpCredentialRecord, projectId: string, limit: number) {
    await this.assertAllowedProject(credential, projectId);
    return this.db
      .select()
      .from(releases)
      .where(eq(releases.projectId, projectId))
      .orderBy(desc(releases.lastSeenAt))
      .limit(limit);
  }

  private async listAutofixRuns(credential: McpCredentialRecord, projectId: string, limit: number) {
    await this.assertAllowedProject(credential, projectId);
    return this.db
      .select()
      .from(autofixRuns)
      .where(eq(autofixRuns.projectId, projectId))
      .orderBy(desc(autofixRuns.createdAt))
      .limit(limit);
  }

  private async updateIssue(
    credential: McpCredentialRecord,
    input: {
      projectId: string;
      issueId: string;
      status?: "open" | "resolved" | "ignored";
      priority?: "low" | "medium" | "high" | "critical";
      confirmed: true;
    },
  ) {
    if (!input.status && !input.priority) {
      throw new ForbiddenException("Provide status or priority");
    }
    await this.assertAllowedProject(credential, input.projectId);
    let issue: unknown;
    if (input.status) {
      issue = await this.issuesService.updateStatus({
        organizationId: credential.organizationId,
        projectId: input.projectId,
        issueId: input.issueId,
        status: input.status,
        actorUserId: credential.createdByUserId,
      });
    }
    if (input.priority) {
      issue = await this.issuesService.updatePriority({
        organizationId: credential.organizationId,
        projectId: input.projectId,
        issueId: input.issueId,
        priority: input.priority,
        actorUserId: credential.createdByUserId,
      });
    }
    return issue;
  }

  private async createIssueComment(
    credential: McpCredentialRecord,
    projectId: string,
    issueId: string,
    body: string,
    _confirmed: true,
  ) {
    await this.assertAllowedProject(credential, projectId);
    return this.issuesService.createComment({
      organizationId: credential.organizationId,
      projectId,
      issueId,
      body,
      actorUserId: credential.createdByUserId,
    });
  }

  private async runAutofix(
    credential: McpCredentialRecord,
    projectId: string,
    issueId: string,
    _confirmed: true,
  ) {
    await this.assertAllowedProject(credential, projectId);
    const [issue] = await this.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.id, issueId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");
    return this.autofixService.trigger({
      organizationId: credential.organizationId,
      projectId,
      issueId,
      actorUserId: credential.createdByUserId,
      trigger: "manual",
    });
  }

  private async allowedProjectIds(credential: McpCredentialRecord) {
    if (credential.allProjects) return null;
    const grants = await this.db
      .select({ projectId: mcpCredentialProjects.projectId })
      .from(mcpCredentialProjects)
      .where(eq(mcpCredentialProjects.credentialId, credential.id));
    return grants.map((grant) => grant.projectId);
  }

  private async assertAllowedProject(credential: McpCredentialRecord, projectId: string) {
    const allowedIds = await this.allowedProjectIds(credential);
    if (allowedIds && !allowedIds.includes(projectId))
      throw new ForbiddenException("Project is not allowed for this MCP credential");
    const [project] = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.organizationId, credential.organizationId)),
      )
      .limit(1);
    if (!project) throw new NotFoundException("Project not found");
  }

  private async assertProjectsBelongToOrganization(organizationId: string, projectIds: string[]) {
    if (!projectIds.length) return;
    const uniqueIds = [...new Set(projectIds)];
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), inArray(projects.id, uniqueIds)));
    if (rows.length !== uniqueIds.length)
      throw new NotFoundException("One or more projects were not found");
  }

  private async assertWithinRateLimit(credentialId: string) {
    const windowStartedAt = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const [counter] = await this.db
      .insert(ingestRateCounters)
      .values({
        scope: "mcp_credential_minute",
        scopeId: credentialId,
        windowStartedAt,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [
          ingestRateCounters.scope,
          ingestRateCounters.scopeId,
          ingestRateCounters.windowStartedAt,
        ],
        set: {
          count: sql`${ingestRateCounters.count} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ count: ingestRateCounters.count });
    if (counter.count > MCP_REQUESTS_PER_MINUTE) {
      throw new HttpException(
        "MCP request limit reached. Try again in a minute.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
