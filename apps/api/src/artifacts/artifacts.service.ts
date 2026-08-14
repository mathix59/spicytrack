import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { releaseArtifacts, releases } from "../database/schema";
import { STORAGE_SERVICE } from "../storage/storage.service";
import type { StorageService } from "../storage/storage.service";

@Injectable()
export class ArtifactsService {
  private readonly logger = new Logger(ArtifactsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  async upsertRelease(input: {
    organizationId: string;
    projectId: string;
    releaseVersion: string;
  }) {
    const [existing] = await this.db
      .select()
      .from(releases)
      .where(
        and(eq(releases.projectId, input.projectId), eq(releases.version, input.releaseVersion)),
      )
      .limit(1);

    if (existing) {
      return { ...existing, eventCount: 0 };
    }

    const [release] = await this.db
      .insert(releases)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        version: input.releaseVersion,
      })
      .returning();

    return { ...release, eventCount: 0 };
  }

  private async getReleaseOrThrow(input: { projectId: string; releaseVersion: string }) {
    const [release] = await this.db
      .select()
      .from(releases)
      .where(
        and(eq(releases.projectId, input.projectId), eq(releases.version, input.releaseVersion)),
      )
      .limit(1);

    if (!release) {
      throw new NotFoundException("Release not found");
    }

    return release;
  }

  async uploadArtifact(input: {
    organizationId: string;
    projectId: string;
    releaseVersion: string;
    name: string;
    contentType?: string;
    body: Buffer;
  }) {
    const release = await this.getReleaseOrThrow({
      projectId: input.projectId,
      releaseVersion: input.releaseVersion,
    });

    const checksum = createHash("sha256").update(input.body).digest("hex");
    const storageKey = `${input.organizationId}/${release.id}/${randomUUID()}-${input.name}`;

    const [existing] = await this.db
      .select()
      .from(releaseArtifacts)
      .where(and(eq(releaseArtifacts.releaseId, release.id), eq(releaseArtifacts.name, input.name)))
      .limit(1);

    await this.storageService.putObject({
      key: storageKey,
      body: input.body,
      contentType: input.contentType,
    });

    if (existing) {
      let updated: typeof releaseArtifacts.$inferSelect | undefined;
      try {
        [updated] = await this.db
          .update(releaseArtifacts)
          .set({
            contentType: input.contentType,
            size: input.body.length,
            checksum,
            storageKey,
          })
          .where(eq(releaseArtifacts.id, existing.id))
          .returning();
      } catch (error) {
        await this.deleteObjectBestEffort(storageKey);
        throw error;
      }
      if (!updated) {
        await this.deleteObjectBestEffort(storageKey);
        throw new NotFoundException("Artifact not found");
      }
      await this.deleteObjectBestEffort(existing.storageKey);

      return this.toArtifactDto(updated);
    }

    let artifact: typeof releaseArtifacts.$inferSelect | undefined;
    try {
      [artifact] = await this.db
        .insert(releaseArtifacts)
        .values({
          organizationId: input.organizationId,
          projectId: input.projectId,
          releaseId: release.id,
          name: input.name,
          contentType: input.contentType,
          size: input.body.length,
          checksum,
          storageKey,
        })
        .returning();
    } catch (error) {
      await this.deleteObjectBestEffort(storageKey);
      throw error;
    }
    if (!artifact) {
      await this.deleteObjectBestEffort(storageKey);
      throw new Error("Artifact metadata was not created");
    }

    return this.toArtifactDto(artifact);
  }

  async listArtifacts(input: { projectId: string; releaseVersion: string }) {
    const release = await this.getReleaseOrThrow(input);

    const artifacts = await this.db
      .select()
      .from(releaseArtifacts)
      .where(eq(releaseArtifacts.releaseId, release.id))
      .orderBy(desc(releaseArtifacts.createdAt));

    return artifacts.map((artifact) => this.toArtifactDto(artifact));
  }

  private toArtifactDto(artifact: typeof releaseArtifacts.$inferSelect) {
    return {
      id: artifact.id,
      releaseId: artifact.releaseId,
      name: artifact.name,
      contentType: artifact.contentType,
      size: artifact.size,
      checksum: artifact.checksum,
      createdAt: artifact.createdAt,
    };
  }

  async deleteArtifact(input: { projectId: string; releaseVersion: string; artifactId: string }) {
    const release = await this.getReleaseOrThrow(input);

    const [artifact] = await this.db
      .delete(releaseArtifacts)
      .where(
        and(eq(releaseArtifacts.releaseId, release.id), eq(releaseArtifacts.id, input.artifactId)),
      )
      .returning();

    if (!artifact) {
      throw new NotFoundException("Artifact not found");
    }

    await this.deleteObjectBestEffort(artifact.storageKey);

    return { success: true };
  }

  private async deleteObjectBestEffort(storageKey: string): Promise<void> {
    try {
      await this.storageService.deleteObject(storageKey);
    } catch (error) {
      this.logger.error(
        `Failed to delete orphaned artifact object ${storageKey}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
