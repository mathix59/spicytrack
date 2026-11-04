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
  events,
  ingestRateCounters,
  issues,
  organizations,
  projectKeys,
  projects,
  releaseHealthSessions,
  releases,
} from "../src/database/schema";
import { IngestService } from "../src/ingest/ingest.service";
import { OrganizationContextGuard } from "../src/rbac/organization-context.guard";
import { PermissionGuard } from "../src/rbac/permission.guard";

function envelope(...items: Array<[string, unknown]>) {
  return [
    JSON.stringify({ sent_at: new Date().toISOString() }),
    ...items.flatMap(([type, payload]) => [JSON.stringify({ type }), JSON.stringify(payload)]),
  ].join("\n");
}

describe("Release health (e2e)", () => {
  let app: NestFastifyApplication;
  let db: DatabaseClient;
  let ingest: IngestService;
  let publicId: string;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const organizationSlug = `health-org-${Date.now()}`;
  const projectId = randomUUID();
  const publicKey = `health${randomUUID().replaceAll("-", "")}`;
  const started = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const production = { release: "1.0.0", environment: "production" };

  const session = (sid: string, fields: Record<string, unknown>) =>
    ["session", { sid, started, attrs: production, ...fields }] as [string, unknown];
  const send = (body: string) => ingest.ingestEnvelope(publicId, body, publicKey);

  beforeAll(async () => {
    const authGuard = {
      canActivate(context: { switchToHttp(): { getRequest(): AuthenticatedRequest } }) {
        const request = context.switchToHttp().getRequest();
        request.auth = { user: { id: userId, email: "health@spicytrack.local" } as never };
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
    ingest = app.get(IngestService);

    await db
      .insert(organizations)
      .values({ id: organizationId, name: "Health", slug: organizationSlug, ownerUserId: userId });
    const [project] = await db
      .insert(projects)
      .values({ id: projectId, organizationId, name: "Health", slug: "health" })
      .returning({ publicId: projects.publicId });
    publicId = String(project.publicId);
    await db.insert(projectKeys).values({ organizationId, projectId, name: "SDK", publicKey });
  });

  afterAll(async () => {
    if (db) {
      await db.delete(ingestRateCounters).where(eq(ingestRateCounters.scopeId, projectId));
      await db.delete(events).where(eq(events.projectId, projectId));
      await db.delete(issues).where(eq(issues.projectId, projectId));
      await db.delete(releases).where(eq(releases.projectId, projectId));
      await db.delete(projectKeys).where(eq(projectKeys.projectId, projectId));
      await db.delete(projects).where(eq(projects.id, projectId));
      await db.delete(organizations).where(eq(organizations.id, organizationId));
    }
    await app?.close();
  });

  const get = async (path: string) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects/health/${path}`,
    });
    return { status: response.statusCode, body: response.json() };
  };

  it("counts each session once, moving it to its worst outcome", async () => {
    await expect(
      send(envelope(session("s1", { init: true, status: "ok", did: "ana" }))),
    ).resolves.toEqual({
      accepted: true,
      sessions: 1,
    });
    await send(envelope(session("s1", { status: "crashed", did: "ana" })));
    // A late, healthier update does not undo the crash.
    await send(envelope(session("s1", { status: "exited", did: "ana" })));
    await send(envelope(session("s2", { status: "exited", errors: 2, did: "bob" })));
    await send(envelope(session("s3", { status: "exited", did: "bob" })));
    await send(
      envelope([
        "session",
        { sid: "s4", started, status: "abnormal", attrs: { release: "2.0.0" } },
      ]),
    );
    // Server SDKs send per-minute counts.
    await send(
      envelope([
        "sessions",
        {
          attrs: { release: "1.0.0", environment: "staging" },
          aggregates: [{ started, exited: 4, errored: 1, crashed: 1, did: "cy" }],
        },
      ]),
    );

    const { status, body } = await get("release-health?period=24h");
    expect(status).toBe(200);
    expect(body.environments).toEqual(["production", "staging"]);
    expect(body.totals).toMatchObject({
      sessions: 10,
      healthy: 5,
      errored: 2,
      abnormal: 1,
      crashed: 2,
      crashFreeSessions: 0.8,
      users: 3,
    });
    expect(body.totals.crashFreeUsers).toBeCloseTo(1 / 3);
    expect(body.releases).toEqual([
      expect.objectContaining({ version: "1.0.0", sessions: 9, crashed: 2, adoption: 0.9 }),
      expect.objectContaining({
        version: "2.0.0",
        sessions: 1,
        abnormal: 1,
        users: 0,
        crashFreeUsers: null,
        adoption: 0.1,
      }),
    ]);
    expect(
      await db
        .select()
        .from(releaseHealthSessions)
        .where(eq(releaseHealthSessions.projectId, projectId)),
    ).toHaveLength(4);
  });

  it("filters by environment and returns a zero-filled series for one release", async () => {
    const filtered = await get("release-health?period=7d&environment=production");
    expect(filtered.body.totals).toMatchObject({ sessions: 3, errored: 1, crashed: 1, users: 2 });

    const detail = await get("releases/1.0.0/health?period=24h");
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ version: "1.0.0", interval: "hour" });
    expect(detail.body.totals).toMatchObject({ sessions: 9, crashed: 2, adoption: 0.9 });
    expect(detail.body.series).toHaveLength(24);
    expect(
      detail.body.series.reduce(
        (sum: number, point: { sessions: number }) => sum + point.sessions,
        0,
      ),
    ).toBe(9);

    const daily = await get("releases/1.0.0/health?period=14d&environment=staging");
    expect(daily.body.series).toHaveLength(14);
    expect(daily.body.totals).toMatchObject({ sessions: 6, crashed: 1, crashFreeUsers: 0 });

    expect((await get("releases/9.9.9/health")).status).toBe(404);
    expect((await get("release-health?period=1y")).status).toBe(400);
  });

  it("stores the event of an envelope that also carries sessions", async () => {
    const result = await send(
      envelope(
        [
          "event",
          { event_id: randomUUID().replaceAll("-", ""), message: "boom", release: "1.0.0" },
        ],
        session("s5", { status: "crashed" }),
        ["session", { sid: "no-release", started, status: "ok" }],
      ),
    );
    expect(result).toMatchObject({ accepted: true, projectId });
    expect((await get("release-health")).body.totals).toMatchObject({ sessions: 11, crashed: 3 });

    await expect(
      send(envelope(["session", { sid: "s6", started, status: "ok" }])),
    ).resolves.toEqual({ accepted: true, sessions: 0 });
  });

  it("counts a session once when its first updates arrive together", async () => {
    const statuses = ["ok", "crashed", "ok", "abnormal", "exited", "crashed", "ok", "exited"];
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => `race-${i}`).flatMap((sid) =>
        statuses.map((status) =>
          send(envelope(session(sid, { status, errors: status === "ok" ? 1 : 0 }))),
        ),
      ),
    );
    expect((await get("release-health")).body.totals).toMatchObject({ sessions: 31, crashed: 23 });
  });

  it("drops sessions past the hourly session quota without refusing the envelope", async () => {
    process.env.INGEST_PROJECT_SESSIONS_PER_HOUR = "1";
    try {
      await expect(send(envelope(session("s7", { status: "ok" })))).resolves.toEqual({
        accepted: true,
        sessions: 0,
      });
    } finally {
      delete process.env.INGEST_PROJECT_SESSIONS_PER_HOUR;
    }
    expect((await get("release-health")).body.totals.sessions).toBe(31);
  });
});
