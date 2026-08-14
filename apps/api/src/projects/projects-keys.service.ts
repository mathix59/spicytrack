import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { AuditService } from "../audit/audit.service";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { projectKeys } from "../database/schema";

import { withDerivedKeyFields } from "./project-key.utils";

@Injectable()
export class ProjectsKeysService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
  ) {}

  async createDefaultKey(input: { organizationId: string; projectId: string }) {
    await this.db.insert(projectKeys).values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: "Default",
      publicKey: randomBytes(18).toString("hex"),
    });
  }

  async listKeys(input: { projectId: string; projectPublicId: number; publicBaseUrl?: string }) {
    const keys = await this.db
      .select()
      .from(projectKeys)
      .where(eq(projectKeys.projectId, input.projectId));

    return keys.map((key) => withDerivedKeyFields(key, input.publicBaseUrl, input.projectPublicId));
  }

  async updateKey(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    keyId: string;
    name?: string;
    isActive?: boolean;
    rateLimitPerMinute?: number | null;
    publicBaseUrl?: string;
    projectPublicId: number;
  }) {
    const [key] = await this.db
      .update(projectKeys)
      .set({
        name: input.name,
        isActive: input.isActive,
        rateLimitPerMinute: input.rateLimitPerMinute,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectKeys.organizationId, input.organizationId),
          eq(projectKeys.projectId, input.projectId),
          eq(projectKeys.id, input.keyId),
        ),
      )
      .returning();

    if (!key) {
      throw new NotFoundException("Project key not found");
    }

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "project_key.update",
      targetType: "project_key",
      targetId: input.keyId,
      payload: {
        name: input.name,
        isActive: input.isActive,
        rateLimitPerMinute: input.rateLimitPerMinute,
      },
    });

    return withDerivedKeyFields(key, input.publicBaseUrl, input.projectPublicId);
  }

  async rotateKey(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    keyId: string;
    publicBaseUrl?: string;
    projectPublicId: number;
  }) {
    const [key] = await this.db
      .update(projectKeys)
      .set({
        publicKey: randomBytes(18).toString("hex"),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectKeys.organizationId, input.organizationId),
          eq(projectKeys.projectId, input.projectId),
          eq(projectKeys.id, input.keyId),
        ),
      )
      .returning();

    if (!key) {
      throw new NotFoundException("Project key not found");
    }

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "project_key.rotate",
      targetType: "project_key",
      targetId: input.keyId,
      payload: {},
    });

    return withDerivedKeyFields(key, input.publicBaseUrl, input.projectPublicId);
  }

  async createKey(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    projectPublicId: number;
    name: string;
    rateLimitPerMinute?: number;
    publicBaseUrl?: string;
  }) {
    const [key] = await this.db
      .insert(projectKeys)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        name: input.name,
        publicKey: randomBytes(18).toString("hex"),
        rateLimitPerMinute: input.rateLimitPerMinute,
      })
      .returning();

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "project_key.create",
      targetType: "project_key",
      targetId: key.id,
      payload: {
        name: input.name,
        rateLimitPerMinute: input.rateLimitPerMinute,
      },
    });

    return withDerivedKeyFields(key, input.publicBaseUrl, input.projectPublicId);
  }
}
