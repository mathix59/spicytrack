import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";

import { AppModule } from "../src/app.module";
import { ArtifactsService } from "../src/artifacts/artifacts.service";
import { DATABASE } from "../src/database/database.provider";
import type { DatabaseClient } from "../src/database/database.provider";
import { organizations, projects, releaseArtifacts, releases, users } from "../src/database/schema";
import { STORAGE_SERVICE, type StorageService } from "../src/storage/storage.service";

describe("Artifact storage resilience (e2e)", () => {
  let db: DatabaseClient;
  let service: ArtifactsService;
  let close: () => Promise<void>;
  const userId = randomUUID();
  const organizationId = randomUUID();
  const projectId = randomUUID();
  const releaseId = randomUUID();
  const putObject = jest.fn<Promise<void>, [Parameters<StorageService["putObject"]>[0]]>();
  const deleteObject = jest.fn<Promise<void>, [string]>();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_SERVICE)
      .useValue({ putObject, deleteObject, getObject: jest.fn() })
      .compile();
    await module.init();
    close = () => module.close();
    db = module.get(DATABASE);
    service = module.get(ArtifactsService);

    await db.insert(users).values({
      id: userId,
      email: `artifact-resilience-${userId}@example.test`,
      passwordHash: "",
      name: "Artifact Resilience",
    });
    await db.insert(organizations).values({
      id: organizationId,
      ownerUserId: userId,
      name: "Artifact Resilience",
      slug: `artifact-resilience-${userId}`,
    });
    await db.insert(projects).values({
      id: projectId,
      organizationId,
      name: "Artifacts",
      slug: `artifacts-${userId}`,
    });
    await db.insert(releases).values({
      id: releaseId,
      organizationId,
      projectId,
      version: "1.0.0",
    });
  });

  afterAll(async () => {
    await db.delete(releaseArtifacts).where(eq(releaseArtifacts.organizationId, organizationId));
    await db.delete(releases).where(eq(releases.organizationId, organizationId));
    await db.delete(projects).where(eq(projects.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await db.delete(users).where(eq(users.id, userId));
    await close();
  });

  beforeEach(() => {
    putObject.mockReset().mockResolvedValue();
    deleteObject.mockReset().mockResolvedValue();
  });

  it("does not create metadata when object storage rejects an upload", async () => {
    putObject.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(
      service.uploadArtifact({
        organizationId,
        projectId,
        releaseVersion: "1.0.0",
        name: "failed.js.map",
        body: Buffer.from("failed"),
      }),
    ).rejects.toThrow("storage unavailable");
    expect(
      await db
        .select()
        .from(releaseArtifacts)
        .where(eq(releaseArtifacts.organizationId, organizationId)),
    ).toHaveLength(0);
  });

  it("keeps new metadata committed when deleting the replaced object fails", async () => {
    await service.uploadArtifact({
      organizationId,
      projectId,
      releaseVersion: "1.0.0",
      name: "app.js.map",
      body: Buffer.from("old"),
    });
    deleteObject.mockRejectedValueOnce(new Error("temporary delete failure"));
    const updated = await service.uploadArtifact({
      organizationId,
      projectId,
      releaseVersion: "1.0.0",
      name: "app.js.map",
      body: Buffer.from("new"),
    });
    expect(updated.size).toBe(3);
    const stored = await db
      .select()
      .from(releaseArtifacts)
      .where(eq(releaseArtifacts.organizationId, organizationId));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.checksum).toBe(updated.checksum);
  });
});
