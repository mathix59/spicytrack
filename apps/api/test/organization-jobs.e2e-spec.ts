import { randomUUID } from "node:crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module";
import { AuthGuard } from "../src/auth/auth.guard";
import { type AuthenticatedRequest } from "../src/common/authenticated-request";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import { jobs, organizations } from "../src/database/schema";
import { OrganizationContextGuard } from "../src/rbac/organization-context.guard";
import { PermissionGuard } from "../src/rbac/permission.guard";

describe("Organization jobs (e2e)", () => {
  let app: NestFastifyApplication;
  let db: DatabaseClient;
  let organizationId: string;
  let organizationSlug: string;
  let otherOrganizationId: string;
  let projectId: string;
  let failedJobId: string;
  let pendingJobId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/spicytrack";
    process.env.STORAGE_ENDPOINT ??= "http://localhost:9002";
    process.env.STORAGE_ACCESS_KEY_ID ??= "spicytrack";
    process.env.STORAGE_SECRET_ACCESS_KEY ??= "spicytrack-secret";

    const mockUser = {
      id: randomUUID(),
      email: "ops-test@spicytrack.local",
    };
    const mockMembership = {
      id: randomUUID(),
      organizationId: "",
      userId: mockUser.id,
      role: "owner",
      invitedByUserId: null,
      joinedAt: new Date(),
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
            name: "Ops Test Org",
            status: "active",
            ownerUserId: mockUser.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never,
          membership: {
            ...mockMembership,
            organizationId,
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

    organizationId = randomUUID();
    organizationSlug = `ops-org-${Date.now()}`;
    otherOrganizationId = randomUUID();
    projectId = randomUUID();

    await db.insert(organizations).values([
      {
        id: organizationId,
        name: "Ops Test Org",
        slug: organizationSlug,
        status: "active",
        ownerUserId: mockUser.id,
      },
      {
        id: otherOrganizationId,
        name: "Other Org",
        slug: `other-${Date.now()}`,
        status: "active",
        ownerUserId: mockUser.id,
      },
    ]);

    const [failedJob, pendingJob] = await db
      .insert(jobs)
      .values([
        {
          organizationId,
          projectId,
          type: "autofix",
          status: "failed",
          payload: { runId: randomUUID() },
          attempts: 3,
          lastError: "boom",
          runAt: new Date(Date.now() - 60_000),
          finishedAt: new Date(),
        },
        {
          organizationId,
          projectId,
          type: "post_ingest_admin",
          status: "pending",
          payload: { issueId: randomUUID() },
          attempts: 1,
          runAt: new Date(Date.now() - 30_000),
        },
        {
          organizationId: otherOrganizationId,
          projectId,
          type: "autofix",
          status: "failed",
          payload: { runId: randomUUID() },
          attempts: 2,
          lastError: "other-org",
          runAt: new Date(Date.now() - 45_000),
          finishedAt: new Date(),
        },
      ])
      .returning();

    failedJobId = failedJob.id;
    pendingJobId = pendingJob.id;
  });

  afterAll(async () => {
    if (db) {
      await db.delete(jobs);
      await db.delete(organizations);
    }

    if (app) {
      await app.close();
    }
  });

  it("filters organization jobs by status, type and project", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/jobs?status=failed&type=autofix&projectId=${projectId}&limit=10`,
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();

    expect(payload.summary.failed).toBe(1);
    expect(payload.jobs).toHaveLength(1);
    expect(payload.jobs[0].id).toBe(failedJobId);
    expect(payload.jobs[0].type).toBe("autofix");
    expect(payload.jobs[0].status).toBe("failed");
  });

  it("requeues a failed job", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/jobs/${failedJobId}/requeue`,
    });

    expect(response.statusCode).toBe(201);
    const payload = response.json();

    expect(payload.id).toBe(failedJobId);
    expect(payload.status).toBe("pending");
    expect(payload.attempts).toBe(0);
    expect(payload.lastError).toBeNull();
  });

  it("rejects requeue for a non-failed job", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/jobs/${pendingJobId}/requeue`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("Only failed jobs can be requeued");
  });
});
