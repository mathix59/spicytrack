import { randomUUID } from "node:crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { eq } from "drizzle-orm";
import { AppModule } from "../src/app.module";
import { AuthGuard } from "../src/auth/auth.guard";
import { type AuthenticatedRequest } from "../src/common/authenticated-request";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import { events, issues, organizations, projects } from "../src/database/schema";
import { OrganizationContextGuard } from "../src/rbac/organization-context.guard";
import { PermissionGuard } from "../src/rbac/permission.guard";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function expectedCounts(start: string, bucketMs: number, bucketCount: number, timestamps: Date[]) {
  const counts = Array.from({ length: bucketCount }, () => 0);
  for (const timestamp of timestamps) {
    const index = Math.floor((timestamp.getTime() - new Date(start).getTime()) / bucketMs);
    if (index >= 0 && index < bucketCount) {
      counts[index] += 1;
    }
  }
  return counts;
}

describe("Event trends (e2e)", () => {
  let app: NestFastifyApplication;
  let db: DatabaseClient;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const organizationSlug = `trends-org-${Date.now()}`;
  const projectId = randomUUID();
  const otherProjectId = randomUUID();
  const busyIssueId = randomUUID();
  const quietIssueId = randomUUID();
  const foreignIssueId = randomUUID();
  const now = Date.now();
  const busyTimestamps = [
    new Date(now),
    new Date(now),
    new Date(now - 3 * HOUR_MS),
    new Date(now - 5 * DAY_MS),
    new Date(now - 20 * DAY_MS),
  ];
  const foreignTimestamps = [new Date(now - 2 * DAY_MS)];

  beforeAll(async () => {
    const authGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        const request = context.switchToHttp().getRequest();
        request.auth = { user: { id: userId, email: "trends-test@spicytrack.local" } as never };
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
            name: "Trends Test Org",
            status: "active",
            ownerUserId: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never,
          membership: {
            id: randomUUID(),
            organizationId,
            userId,
            role: "owner",
            invitedByUserId: null,
            joinedAt: new Date(),
          } as never,
        };
        return true;
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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

    await db.insert(organizations).values({
      id: organizationId,
      name: "Trends Test Org",
      slug: organizationSlug,
      ownerUserId: userId,
    });
    await db.insert(projects).values([
      { id: projectId, organizationId, name: "Trends", slug: "trends" },
      { id: otherProjectId, organizationId, name: "Other", slug: "other" },
    ]);
    await db.insert(issues).values([
      {
        id: busyIssueId,
        organizationId,
        projectId,
        groupingKey: `trends-busy-${busyIssueId}`,
        title: "Busy issue",
      },
      {
        id: quietIssueId,
        organizationId,
        projectId,
        groupingKey: `trends-quiet-${quietIssueId}`,
        title: "Quiet issue",
      },
      {
        id: foreignIssueId,
        organizationId,
        projectId: otherProjectId,
        groupingKey: `trends-foreign-${foreignIssueId}`,
        title: "Foreign issue",
      },
    ]);

    const event = (issueProjectId: string, issueId: string, timestamp: Date) => ({
      organizationId,
      projectId: issueProjectId,
      issueId,
      eventId: randomUUID().replaceAll("-", ""),
      timestamp,
      rawPayload: {},
    });
    await db
      .insert(events)
      .values([
        ...busyTimestamps.map((timestamp) => event(projectId, busyIssueId, timestamp)),
        ...foreignTimestamps.map((timestamp) => event(otherProjectId, foreignIssueId, timestamp)),
      ]);
  });

  afterAll(async () => {
    if (db) {
      await db.delete(events).where(eq(events.organizationId, organizationId));
      await db.delete(issues).where(eq(issues.organizationId, organizationId));
      await db.delete(projects).where(eq(projects.organizationId, organizationId));
      await db.delete(organizations).where(eq(organizations.id, organizationId));
    }

    if (app) {
      await app.close();
    }
  });

  const trendsUrl = (query: string) =>
    `/api/organizations/${organizationSlug}/projects/trends/issues/trends?${query}`;

  it("returns zero-filled hourly trends scoped to the project", async () => {
    const response = await app.inject({
      method: "GET",
      url: trendsUrl(`issueIds=${busyIssueId},${quietIssueId},${foreignIssueId}&period=24h`),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    expect(payload.period).toBe("24h");
    expect(payload.bucketSeconds).toBe(3600);
    expect(new Date(payload.start).getUTCMinutes()).toBe(0);
    expect(payload.items.map((item: { issueId: string }) => item.issueId)).toEqual([
      busyIssueId,
      quietIssueId,
    ]);

    const [busy, quiet] = payload.items;
    expect(busy.counts).toEqual(expectedCounts(payload.start, HOUR_MS, 24, busyTimestamps));
    expect(busy.counts[23]).toBe(2);
    expect(busy.counts[20]).toBe(1);
    expect(quiet.counts).toEqual(Array.from({ length: 24 }, () => 0));
  });

  it("returns 14 daily buckets ending today", async () => {
    const response = await app.inject({
      method: "GET",
      url: trendsUrl(`issueIds=${busyIssueId}&period=14d`),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    expect(payload.bucketSeconds).toBe(86400);
    expect(new Date(payload.start).toISOString()).toMatch(/T00:00:00\.000Z$/);
    const [busy] = payload.items;
    expect(busy.counts).toHaveLength(14);
    expect(busy.counts[13]).toBeGreaterThanOrEqual(2);
    expect(busy.counts).toEqual(expectedCounts(payload.start, DAY_MS, 14, busyTimestamps));
  });

  it("validates issueIds and period", async () => {
    const tooMany = Array.from({ length: 101 }, () => randomUUID()).join(",");

    for (const query of ["period=24h", `issueIds=not-a-uuid`, `issueIds=${tooMany}`]) {
      const response = await app.inject({ method: "GET", url: trendsUrl(query) });
      expect(response.statusCode).toBe(400);
    }

    const badPeriod = await app.inject({
      method: "GET",
      url: trendsUrl(`issueIds=${busyIssueId}&period=7d`),
    });
    expect(badPeriod.statusCode).toBe(400);
  });

  it("exposes 14 day event trends in the organization overview", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/overview`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    const start = new Date(now - 13 * DAY_MS);
    start.setUTCHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    expect(payload.eventTrend14d).toEqual(
      expectedCounts(startIso, DAY_MS, 14, [...busyTimestamps, ...foreignTimestamps]),
    );

    const trendsProject = payload.projects.find(
      (project: { id: string }) => project.id === projectId,
    );
    const otherProject = payload.projects.find(
      (project: { id: string }) => project.id === otherProjectId,
    );
    expect(trendsProject.eventTrend14d).toEqual(
      expectedCounts(startIso, DAY_MS, 14, busyTimestamps),
    );
    expect(otherProject.eventTrend14d).toEqual(
      expectedCounts(startIso, DAY_MS, 14, foreignTimestamps),
    );
  });
});
