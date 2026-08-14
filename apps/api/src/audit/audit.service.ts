import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { auditLogs } from "../database/schema";

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async record(input: {
    organizationId: string;
    projectId?: string | null;
    actorUserId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    payload?: Record<string, unknown>;
  }) {
    await this.db.insert(auditLogs).values({
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      payload: input.payload ?? {},
    });
  }

  async listProjectAudit(projectId: string, limit = 50) {
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.projectId, projectId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}
