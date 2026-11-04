import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, isNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { currentAuditRequest } from "../common/audit-request";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { auditLogs, personalAccessTokens, projects, users } from "../database/schema";
import {
  type AuditCursor,
  type AuditFilters,
  encodeAuditCursor,
  MAX_AUDIT_EXPORT_ROWS,
} from "./audit-query";

/**
 * An organization's log, one project's entries in it, or the instance log (super-admin actions
 * outside organizations).
 */
export type AuditScope = { organizationId: string; projectId?: string } | { instance: true };

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async record(input: {
    /** Null for instance-level events. */
    organizationId: string | null;
    projectId?: string | null;
    actorUserId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    payload?: Record<string, unknown>;
  }) {
    // Jobs and workers run outside a request: no IP, user agent or token.
    const request = currentAuditRequest();
    await this.db.insert(auditLogs).values({
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorTokenId: request?.tokenId ?? null,
      ipAddress: request?.ipAddress ?? null,
      userAgent: request?.userAgent ?? null,
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
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit);
  }

  async list(scope: AuditScope, filters: AuditFilters, limit: number, cursor?: AuditCursor) {
    const rows = await this.query(scope, filters, limit + 1, cursor);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map(withoutCursorKey),
      nextCursor:
        rows.length > limit && last
          ? encodeAuditCursor({ createdAt: last.cursorKey, id: last.id })
          : null,
    };
  }

  /** Newest first, capped; `truncated` tells the caller to narrow the filters. */
  async export(scope: AuditScope, filters: AuditFilters) {
    const rows = await this.query(scope, filters, MAX_AUDIT_EXPORT_ROWS + 1);
    return {
      rows: rows.slice(0, MAX_AUDIT_EXPORT_ROWS).map(withoutCursorKey),
      truncated: rows.length > MAX_AUDIT_EXPORT_ROWS,
    };
  }

  /** Distinct actions and target types, to populate the filter menus. */
  async facets(scope: AuditScope) {
    const where = this.scopeCondition(scope);
    const [actions, targetTypes] = await Promise.all([
      this.db
        .selectDistinct({ value: auditLogs.action })
        .from(auditLogs)
        .where(where)
        .orderBy(auditLogs.action)
        .limit(500),
      this.db
        .selectDistinct({ value: auditLogs.targetType })
        .from(auditLogs)
        .where(where)
        .orderBy(auditLogs.targetType)
        .limit(100),
    ]);
    return {
      actions: actions.map((row) => row.value),
      targetTypes: targetTypes.map((row) => row.value),
    };
  }

  private scopeCondition(scope: AuditScope) {
    if ("instance" in scope) return isNull(auditLogs.organizationId);
    const organization = eq(auditLogs.organizationId, scope.organizationId);
    return scope.projectId
      ? and(organization, eq(auditLogs.projectId, scope.projectId))!
      : organization;
  }

  private query(scope: AuditScope, filters: AuditFilters, limit: number, cursor?: AuditCursor) {
    const conditions: SQL[] = [this.scopeCondition(scope)];
    if (filters.action) {
      conditions.push(
        filters.action.endsWith(".")
          ? like(auditLogs.action, `${filters.action.replace(/_/g, "\\_")}%`)
          : eq(auditLogs.action, filters.action),
      );
    }
    if (filters.actorUserId) conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
    if (filters.projectId) conditions.push(eq(auditLogs.projectId, filters.projectId));
    if (filters.targetType) conditions.push(eq(auditLogs.targetType, filters.targetType));
    if (filters.from) conditions.push(gte(auditLogs.createdAt, filters.from));
    if (filters.to) conditions.push(lte(auditLogs.createdAt, filters.to));
    if (cursor) {
      // Compared as text-cast timestamps: a JS Date would drop the microseconds.
      const createdAt = sql`${cursor.createdAt}::timestamptz`;
      conditions.push(
        or(
          lt(auditLogs.createdAt, createdAt),
          and(eq(auditLogs.createdAt, createdAt), sql`${auditLogs.id} < ${cursor.id}::uuid`),
        )!,
      );
    }

    return this.db
      .select({
        id: auditLogs.id,
        organizationId: auditLogs.organizationId,
        projectId: auditLogs.projectId,
        projectName: projects.name,
        actorUserId: auditLogs.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
        actorTokenId: auditLogs.actorTokenId,
        actorTokenName: personalAccessTokens.name,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        payload: auditLogs.payload,
        createdAt: auditLogs.createdAt,
        cursorKey: sql<string>`to_char(${auditLogs.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .leftJoin(projects, eq(projects.id, auditLogs.projectId))
      .leftJoin(personalAccessTokens, eq(personalAccessTokens.id, auditLogs.actorTokenId))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit);
  }
}

function withoutCursorKey<T extends { cursorKey: string }>({ cursorKey: _cursorKey, ...entry }: T) {
  return entry;
}

export type AuditEntry = Awaited<ReturnType<AuditService["list"]>>["items"][number];
