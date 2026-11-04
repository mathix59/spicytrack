import { randomUUID } from "node:crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import { AppModule } from "../src/app.module";
import { AuthGuard } from "../src/auth/auth.guard";
import { type AuthenticatedRequest } from "../src/common/authenticated-request";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import {
  alertDeliveries,
  alertRules,
  auditLogs,
  events,
  issues,
  organizations,
  projects,
  releases,
} from "../src/database/schema";
import { OrganizationContextGuard } from "../src/rbac/organization-context.guard";
import { PermissionGuard } from "../src/rbac/permission.guard";

/** Release issues, alert deliveries and the project audit log: bounded lists with pages. */
describe("Project tab lists (e2e)", () => {
  let app: NestFastifyApplication;
  let db: DatabaseClient;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const organizationSlug = `tab-lists-org-${Date.now()}`;
  const projectId = randomUUID();
  const otherProjectId = randomUUID();
  const releaseId = randomUUID();
  const ruleId = randomUUID();
  const base = () => `/api/organizations/${organizationSlug}/projects/tabs`;

  beforeAll(async () => {
    const authGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        const request = context.switchToHttp().getRequest();
        request.auth = { user: { id: userId, email: "tabs@spicytrack.local" } as never };
        return true;
      },
    };
    const organizationGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        const request = context.switchToHttp().getRequest();
        request.organization = {
          organization: { id: organizationId, slug: organizationSlug } as never,
          membership: { organizationId, userId, role: "owner" } as never,
        };
        return true;
      },
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(OrganizationContextGuard)
      .useValue(organizationGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);

    await db
      .insert(organizations)
      .values({ id: organizationId, name: "Tabs", slug: organizationSlug, ownerUserId: userId });
    await db.insert(projects).values([
      { id: projectId, organizationId, name: "Tabs", slug: "tabs" },
      { id: otherProjectId, organizationId, name: "Other", slug: "other" },
    ]);
    await db
      .insert(releases)
      .values({ id: releaseId, organizationId, projectId, version: "2.0.0" });

    // 12 issues in the release, seen 1..12 times, plus one outside it.
    const issueRows = Array.from({ length: 13 }, (_, index) => ({
      id: randomUUID(),
      organizationId,
      projectId,
      groupingKey: `tabs-${index}-${randomUUID()}`,
      title: `Issue ${index + 1}`,
      timesSeen: index + 1,
    }));
    await db.insert(issues).values(issueRows);
    await db.insert(events).values(
      issueRows.flatMap((issue, index) =>
        // Two events each, so a distinct count would catch duplicated rows.
        [0, 1].map(() => ({
          organizationId,
          projectId,
          issueId: issue.id,
          releaseId: index < 12 ? releaseId : null,
          eventId: randomUUID().replaceAll("-", ""),
          timestamp: new Date(),
          rawPayload: {},
        })),
      ),
    );

    await db.insert(alertRules).values({
      id: ruleId,
      organizationId,
      projectId,
      name: "On-call",
      triggerTypes: ["new_issue"],
      destinationType: "email",
      destinationTarget: "oncall@spicytrack.local",
    });
    const start = Date.now() - 60 * 60 * 1000;
    await db.insert(alertDeliveries).values(
      Array.from({ length: 30 }, (_, index) => ({
        organizationId,
        projectId,
        alertRuleId: ruleId,
        status: index % 3 === 0 ? "failed" : "success",
        attempts: 1,
        payload: { issueTitle: `Delivery ${index}` },
        // Pairs share a timestamp so the cursor must also order by id.
        createdAt: new Date(start + Math.floor(index / 2) * 1000),
      })),
    );

    await db.insert(auditLogs).values([
      ...Array.from({ length: 3 }, (_, index) => ({
        organizationId,
        projectId,
        actorUserId: userId,
        action: index === 0 ? "project.updated" : "project_key.created",
        targetType: index === 0 ? "project" : "project_key",
        targetId: projectId,
        payload: {},
      })),
      {
        organizationId,
        projectId: otherProjectId,
        actorUserId: userId,
        action: "project.updated",
        targetType: "project",
        payload: {},
      },
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db.delete(auditLogs).where(eq(auditLogs.organizationId, organizationId));
      await db.delete(alertDeliveries).where(eq(alertDeliveries.organizationId, organizationId));
      await db.delete(alertRules).where(eq(alertRules.organizationId, organizationId));
      await db.delete(events).where(eq(events.organizationId, organizationId));
      await db.delete(issues).where(eq(issues.organizationId, organizationId));
      await db.delete(releases).where(eq(releases.organizationId, organizationId));
      await db.delete(projects).where(eq(projects.organizationId, organizationId));
      await db.delete(organizations).where(eq(organizations.id, organizationId));
    }
    await app?.close();
  });

  const get = async (path: string) => {
    const response = await app.inject({ method: "GET", url: `${base()}/${path}` });
    return { status: response.statusCode, body: response.json() };
  };

  it("returns a release's 10 most seen issues and counts them all", async () => {
    const { status, body } = await get("releases/2.0.0");
    expect(status).toBe(200);
    expect(body.issuesTotal).toBe(12);
    expect(body.issues).toHaveLength(10);
    expect(body.issues.map((issue: { timesSeen: number }) => issue.timesSeen)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ]);
  });

  it("pages alert deliveries with a cursor, newest first, with their rule", async () => {
    const first = await get("alerts/deliveries");
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(25);
    expect(first.body.items[0]).toMatchObject({
      ruleName: "On-call",
      destinationType: "email",
      payload: { issueTitle: expect.stringMatching(/^Delivery (28|29)$/) },
    });
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await get(
      `alerts/deliveries?cursor=${encodeURIComponent(first.body.nextCursor)}`,
    );
    expect(second.body.items).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);
    expect(new Set(ids).size).toBe(30);
    const createdAt = [...first.body.items, ...second.body.items].map(
      (item: { createdAt: string }) => new Date(item.createdAt).getTime(),
    );
    expect(createdAt).toEqual([...createdAt].sort((a, b) => b - a));
  });

  it("filters alert deliveries by status and validates the query", async () => {
    const failed = await get("alerts/deliveries?status=failed&limit=6");
    expect(failed.body.items).toHaveLength(6);
    expect(failed.body.items.every((item: { status: string }) => item.status === "failed")).toBe(
      true,
    );
    const rest = await get(
      `alerts/deliveries?status=failed&limit=6&cursor=${encodeURIComponent(failed.body.nextCursor)}`,
    );
    expect(rest.body.items).toHaveLength(4);
    expect(rest.body.nextCursor).toBeNull();

    expect((await get("alerts/deliveries?status=lost")).status).toBe(400);
    expect((await get("alerts/deliveries?limit=500")).status).toBe(400);
    expect((await get("alerts/deliveries?cursor=nope")).status).toBe(400);
  });

  it("lists the project's audit entries with filters, facets and pages", async () => {
    const all = await get("audit/entries");
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(3);
    expect(all.body.items[0]).toMatchObject({ projectName: "Tabs", actorEmail: null });

    const filtered = await get("audit/entries?action=project_key.&limit=1");
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].action).toBe("project_key.created");
    const older = await get(
      `audit/entries?action=project_key.&limit=1&cursor=${encodeURIComponent(filtered.body.nextCursor)}`,
    );
    expect(older.body.items).toHaveLength(1);
    expect(older.body.nextCursor).toBeNull();

    // A projectId filter cannot reach another project.
    const escaped = await get(`audit/entries?projectId=${otherProjectId}`);
    expect(escaped.body.items).toHaveLength(3);

    expect((await get("audit/facets")).body).toEqual({
      actions: ["project.updated", "project_key.created"],
      targetTypes: ["project", "project_key"],
    });

    // The legacy endpoint keeps its plain list.
    expect(Array.isArray((await get("audit")).body)).toBe(true);
  });
});
