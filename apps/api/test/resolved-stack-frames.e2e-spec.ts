import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";

import { AppModule } from "../src/app.module";
import { ArtifactsService } from "../src/artifacts/artifacts.service";
import { SourcemapResolverService } from "../src/artifacts/sourcemap-resolver.service";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import {
  events,
  organizations,
  projects,
  releaseArtifacts,
  releases,
  resolvedStackFrames,
  users,
} from "../src/database/schema";
import { IssuesService } from "../src/issues/issues.service";
import { RetentionCleanupHandler } from "../src/jobs/handlers/retention-cleanup.handler";
import { JobsWorkerModule } from "../src/jobs/jobs-worker.module";
import { STORAGE_SERVICE } from "../src/storage/storage.service";

const sourceMap = (source: string) =>
  Buffer.from(
    JSON.stringify({
      version: 3,
      file: "app.js",
      names: ["checkout"],
      sources: [source],
      sourcesContent: ["export function checkout() {}"],
      mappings: "AAAAA",
    }),
  );

describe("Resolved stack frames (e2e)", () => {
  let db: DatabaseClient;
  let resolver: SourcemapResolverService;
  let artifactsService: ArtifactsService;
  let issuesService: IssuesService;
  let retention: RetentionCleanupHandler;
  let close: () => Promise<void>;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const projectId = randomUUID();
  const releaseId = randomUUID();
  const eventRowId = randomUUID();
  const objects = new Map<string, Buffer>();
  const getObject = jest.fn(async (key: string) => {
    const object = objects.get(key);
    if (!object) throw new Error(`missing object ${key}`);
    return object;
  });
  const putObject = jest.fn(async ({ key, body }: { key: string; body: Buffer }) => {
    objects.set(key, body);
  });

  const storedRows = () =>
    db.select().from(resolvedStackFrames).where(eq(resolvedStackFrames.releaseId, releaseId));

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule, JobsWorkerModule] })
      .overrideProvider(STORAGE_SERVICE)
      .useValue({ putObject, getObject, deleteObject: jest.fn() })
      .compile();
    await module.init();
    close = () => module.close();
    db = module.get(DATABASE);
    resolver = module.get(SourcemapResolverService);
    artifactsService = module.get(ArtifactsService);
    issuesService = module.get(IssuesService);
    retention = module.get(RetentionCleanupHandler);

    await db.insert(users).values({
      id: userId,
      email: `resolved-frames-${userId}@example.test`,
      passwordHash: "",
      name: "Resolved Frames",
    });
    await db.insert(organizations).values({
      id: organizationId,
      ownerUserId: userId,
      name: "Resolved Frames",
      slug: `resolved-frames-${userId}`,
    });
    await db.insert(projects).values({
      id: projectId,
      organizationId,
      name: "Storefront",
      slug: `storefront-${userId}`,
    });
    await db
      .insert(releases)
      .values({ id: releaseId, organizationId, projectId, version: "1.0.0" });
    await artifactsService.uploadArtifact({
      organizationId,
      projectId,
      releaseVersion: "1.0.0",
      name: "~/static/app.js.map",
      body: sourceMap("../src/checkout.ts"),
    });
    await db.insert(events).values({
      id: eventRowId,
      organizationId,
      projectId,
      issueId: randomUUID(),
      releaseId,
      eventId: randomUUID().replaceAll("-", ""),
      platform: "javascript",
      sdkName: "sentry.javascript.nextjs",
      level: "error",
      timestamp: new Date(),
      rawPayload: {
        exception: {
          values: [
            {
              type: "TypeError",
              value: "boom",
              stacktrace: {
                frames: [
                  {
                    filename: "https://shop.test/static/app.js",
                    function: "a",
                    lineno: 1,
                    colno: 1,
                  },
                  {
                    filename: "https://shop.test/static/app.js",
                    function: "b",
                    lineno: 1,
                    colno: 2,
                  },
                ],
              },
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await db.delete(events).where(eq(events.organizationId, organizationId));
    await db.delete(releaseArtifacts).where(eq(releaseArtifacts.organizationId, organizationId));
    await db.delete(releases).where(eq(releases.organizationId, organizationId));
    await db.delete(projects).where(eq(projects.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, userId));
    await close();
  });

  it("prepares an event's frames so its view reads them without downloading the map", async () => {
    await resolver.prepareEventFrames(projectId, eventRowId);
    expect(await storedRows()).toHaveLength(2);
    expect(getObject).toHaveBeenCalledTimes(1);

    getObject.mockClear();
    const event = await issuesService.getEvent(projectId, eventRowId);

    expect(getObject).not.toHaveBeenCalled();
    expect(event.resolvedFrames).toEqual([
      expect.objectContaining({ filename: "../src/checkout.ts", diagnostic: "resolved" }),
      expect.objectContaining({ filename: "../src/checkout.ts", diagnostic: "resolved" }),
    ]);
  });

  it("resolves with the new map once an artifact is replaced", async () => {
    await artifactsService.uploadArtifact({
      organizationId,
      projectId,
      releaseVersion: "1.0.0",
      name: "~/static/app.js.map",
      body: sourceMap("../src/checkout-v2.ts"),
    });
    expect(await storedRows()).toHaveLength(0);

    const event = await issuesService.getEvent(projectId, eventRowId);

    expect(event.resolvedFrames[0]).toEqual(
      expect.objectContaining({ filename: "../src/checkout-v2.ts" }),
    );
    expect(await storedRows()).toHaveLength(2);
  });

  it("prunes the stored frames of a release no event reached for 30 days", async () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    await db
      .update(releases)
      .set({ lastSeenAt: new Date(Date.now() - 29 * DAY_MS) })
      .where(eq(releases.id, releaseId));
    await retention.pruneResolvedFrames();
    expect(await storedRows()).toHaveLength(2);

    await db
      .update(releases)
      .set({ lastSeenAt: new Date(Date.now() - 31 * DAY_MS) })
      .where(eq(releases.id, releaseId));
    await retention.pruneResolvedFrames();
    expect(await storedRows()).toHaveLength(0);

    await issuesService.getEvent(projectId, eventRowId);
    expect(await storedRows()).toHaveLength(2);
  });

  it("drops the stored frames with their release", async () => {
    await db.delete(releaseArtifacts).where(eq(releaseArtifacts.releaseId, releaseId));
    await db.delete(releases).where(eq(releases.id, releaseId));

    expect(await storedRows()).toHaveLength(0);
  });
});
