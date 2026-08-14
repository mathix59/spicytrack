import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { SourcemapResolverService } from "../artifacts/sourcemap-resolver.service";
import { redactEventPayload } from "../common/event-payload-redaction";
import { getAllFrames } from "../common/grouping";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  environments,
  events,
  issueActivity,
  issueComments,
  issues,
  organizationMembers,
  releases,
} from "../database/schema";

import { IssuesHistoryService } from "./issues-history.service";
import { buildIssueListFilters, eventSelect, resolveIssueSortOrder } from "./issues-query.utils";

@Injectable()
export class IssuesService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly issuesHistoryService: IssuesHistoryService,
    private readonly sourcemapResolverService: SourcemapResolverService,
  ) {}

  async listByProject(input: {
    projectId: string;
    page: number;
    pageSize: number;
    q?: string;
    level?: string;
    priority?: string;
    status?: string;
    assignedUserId?: string;
    isRegressed?: boolean;
    environment?: string;
    release?: string;
    sortBy?: "lastSeenAt" | "firstSeenAt" | "timesSeen";
    sortDir?: "asc" | "desc";
  }) {
    const whereClause = and(...buildIssueListFilters(this.db, input));
    const offset = (input.page - 1) * input.pageSize;
    const sortOrder = resolveIssueSortOrder(input);

    const [totalRow, items] = await Promise.all([
      this.db.select({ value: count() }).from(issues).where(whereClause),
      this.db
        .select()
        .from(issues)
        .where(whereClause)
        .orderBy(sortOrder)
        .limit(input.pageSize)
        .offset(offset),
    ]);

    return {
      items,
      total: totalRow[0]?.value ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getIssue(input: {
    projectId: string;
    issueId: string;
    eventPage: number;
    eventPageSize: number;
  }) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .limit(1);

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    const eventOffset = (input.eventPage - 1) * input.eventPageSize;
    const [totalRow, relatedEvents] = await Promise.all([
      this.db.select({ value: count() }).from(events).where(eq(events.issueId, issue.id)),
      this.db
        .select(eventSelect)
        .from(events)
        .leftJoin(environments, eq(events.environmentId, environments.id))
        .leftJoin(releases, eq(events.releaseId, releases.id))
        .where(eq(events.issueId, issue.id))
        .orderBy(desc(events.timestamp))
        .limit(input.eventPageSize)
        .offset(eventOffset),
    ]);

    return {
      issue,
      events: {
        items: relatedEvents.map((event) => ({
          ...event,
          rawPayload: redactEventPayload(event.rawPayload as Record<string, unknown>),
        })),
        total: totalRow[0]?.value ?? 0,
        page: input.eventPage,
        pageSize: input.eventPageSize,
      },
    };
  }

  async getEvent(projectId: string, eventId: string) {
    const [event] = await this.db
      .select(eventSelect)
      .from(events)
      .leftJoin(environments, eq(events.environmentId, environments.id))
      .leftJoin(releases, eq(events.releaseId, releases.id))
      .where(and(eq(events.projectId, projectId), eq(events.id, eventId)))
      .limit(1);

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    const rawPayload = redactEventPayload(event.rawPayload as Record<string, unknown>);
    const resolvedFrames = await this.sourcemapResolverService.resolveFrames({
      releaseId: event.releaseId,
      frames: getAllFrames(rawPayload),
      sdkName: event.sdkName,
      platform: event.platform,
    });

    return { ...event, rawPayload, resolvedFrames };
  }

  async updateStatus(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    status: string;
    actorUserId: string;
    ignoredUntil?: Date | null;
  }) {
    const resolved = input.status === "resolved" || input.status === "ignored";
    const [issue] = await this.db
      .update(issues)
      .set({
        status: input.status,
        resolvedAt: resolved ? new Date() : null,
        resolvedByUserId: resolved ? input.actorUserId : null,
        ignoredUntil: input.status === "ignored" ? (input.ignoredUntil ?? null) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .returning();

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      activityType: "issue.status_changed",
      activityPayload: { status: input.status, ignoredUntil: input.ignoredUntil ?? null },
      auditAction: "issue.status.update",
      auditPayload: { status: input.status, ignoredUntil: input.ignoredUntil ?? null },
    });

    return issue;
  }

  async updateAssignee(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    assignedUserId?: string | null;
  }) {
    await this.assertAssignableMember(input.organizationId, input.assignedUserId);

    const [issue] = await this.db
      .update(issues)
      .set({
        assignedUserId: input.assignedUserId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .returning();

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      activityType: "issue.assignee_changed",
      activityPayload: { assignedUserId: input.assignedUserId ?? null },
      auditAction: "issue.assignee.update",
      auditPayload: { assignedUserId: input.assignedUserId ?? null },
    });

    return issue;
  }

  async updatePriority(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    priority: string;
  }) {
    const [issue] = await this.db
      .update(issues)
      .set({ priority: input.priority, updatedAt: new Date() })
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .returning();

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      activityType: "issue.priority_changed",
      activityPayload: { priority: input.priority },
      auditAction: "issue.priority.update",
      auditPayload: { priority: input.priority },
    });

    return issue;
  }

  async updateExternalLink(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    externalIssueUrl?: string | null;
  }) {
    const [issue] = await this.db
      .update(issues)
      .set({ externalIssueUrl: input.externalIssueUrl ?? null, updatedAt: new Date() })
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .returning();
    if (!issue) throw new NotFoundException("Issue not found");
    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      activityType: "issue.external_link_changed",
      activityPayload: { externalIssueUrl: input.externalIssueUrl ?? null },
      auditAction: "issue.external_link.update",
      auditPayload: { externalIssueUrl: input.externalIssueUrl ?? null },
    });
    return issue;
  }

  async mergeIssue(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    targetIssueId: string;
    actorUserId: string;
  }) {
    if (input.issueId === input.targetIssueId) {
      throw new BadRequestException("Target issue must differ from source issue");
    }
    const { source, target } = await this.db.transaction(async (tx) => {
      const lockedIds = [input.issueId, input.targetIssueId].sort((left, right) =>
        left.localeCompare(right),
      );
      await tx.execute(
        sql`select id from ${issues} where ${issues.projectId} = ${input.projectId} and ${issues.id} in (${sql.join(
          lockedIds.map((id) => sql`${id}`),
          sql`, `,
        )}) order by id for update`,
      );
      const lockedIssues = await tx
        .select()
        .from(issues)
        .where(and(eq(issues.projectId, input.projectId), inArray(issues.id, lockedIds)));
      const source = lockedIssues.find((issue) => issue.id === input.issueId);
      const target = lockedIssues.find((issue) => issue.id === input.targetIssueId);
      if (!source || !target) {
        throw new NotFoundException("Issue not found");
      }
      if (source.mergedIntoIssueId) {
        throw new BadRequestException("Source issue is already merged");
      }
      if (target.mergedIntoIssueId) {
        throw new BadRequestException("Target issue is already merged into another issue");
      }
      await tx.update(events).set({ issueId: target.id }).where(eq(events.issueId, source.id));
      await tx
        .update(issues)
        .set({
          timesSeen: target.timesSeen + source.timesSeen,
          firstSeenAt:
            source.firstSeenAt < target.firstSeenAt ? source.firstSeenAt : target.firstSeenAt,
          lastSeenAt: source.lastSeenAt > target.lastSeenAt ? source.lastSeenAt : target.lastSeenAt,
          lastEventId:
            source.lastSeenAt > target.lastSeenAt ? source.lastEventId : target.lastEventId,
          updatedAt: new Date(),
        })
        .where(eq(issues.id, target.id));
      await tx
        .update(issues)
        .set({
          status: "merged",
          mergedIntoIssueId: target.id,
          lastEventId: null,
          updatedAt: new Date(),
        })
        .where(eq(issues.id, source.id));
      return { source, target };
    });
    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: target.id,
      actorUserId: input.actorUserId,
      activityType: "issue.merged",
      activityPayload: { sourceIssueId: source.id },
      auditAction: "issue.merge",
      auditPayload: { sourceIssueId: source.id, targetIssueId: target.id },
    });
    return this.assertIssueRecord(input.projectId, target.id);
  }

  async unmergeIssue(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
  }) {
    const currentIssue = await this.assertIssueRecord(input.projectId, input.issueId);
    if (!currentIssue.mergedIntoIssueId) {
      throw new BadRequestException("Issue is not merged");
    }
    const [issue] = await this.db
      .update(issues)
      .set({ status: "open", mergedIntoIssueId: null, timesSeen: 0, updatedAt: new Date() })
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .returning();
    if (!issue) throw new NotFoundException("Issue not found");
    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      activityType: "issue.unmerged",
      activityPayload: {},
      auditAction: "issue.unmerge",
      auditPayload: {},
    });
    return issue;
  }

  async bulkUpdateStatus(input: {
    organizationId: string;
    projectId: string;
    issueIds: string[];
    status: string;
    actorUserId: string;
  }) {
    if (input.issueIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const resolved = input.status === "resolved" || input.status === "ignored";
    const updated = await this.db
      .update(issues)
      .set({
        status: input.status,
        resolvedAt: resolved ? new Date() : null,
        resolvedByUserId: resolved ? input.actorUserId : null,
        ignoredUntil: input.status === "ignored" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(issues.projectId, input.projectId), inArray(issues.id, input.issueIds)))
      .returning({ id: issues.id });

    await this.issuesHistoryService.recordBulkIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueIds: updated.map((issue) => issue.id),
      actorUserId: input.actorUserId,
      activityType: "issue.status_changed",
      activityPayload: { status: input.status, bulk: true },
      auditAction: "issue.status.bulk_update",
      auditPayload: {
        issueIds: input.issueIds,
        status: input.status,
        updatedCount: updated.length,
      },
    });

    return { success: true, updatedCount: updated.length };
  }

  async bulkUpdatePriority(input: {
    organizationId: string;
    projectId: string;
    issueIds: string[];
    actorUserId: string;
    priority: string;
  }) {
    if (input.issueIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const updated = await this.db
      .update(issues)
      .set({ priority: input.priority, updatedAt: new Date() })
      .where(and(eq(issues.projectId, input.projectId), inArray(issues.id, input.issueIds)))
      .returning({ id: issues.id });

    await this.issuesHistoryService.recordBulkIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueIds: updated.map((issue) => issue.id),
      actorUserId: input.actorUserId,
      activityType: "issue.priority_changed",
      activityPayload: { priority: input.priority, bulk: true },
      auditAction: "issue.priority.bulk_update",
      auditPayload: {
        issueIds: input.issueIds,
        priority: input.priority,
        updatedCount: updated.length,
      },
    });

    return { success: true, updatedCount: updated.length };
  }

  async bulkUpdateAssignee(input: {
    organizationId: string;
    projectId: string;
    issueIds: string[];
    actorUserId: string;
    assignedUserId?: string | null;
  }) {
    if (input.issueIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    await this.assertAssignableMember(input.organizationId, input.assignedUserId);

    const updated = await this.db
      .update(issues)
      .set({
        assignedUserId: input.assignedUserId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(issues.projectId, input.projectId), inArray(issues.id, input.issueIds)))
      .returning({ id: issues.id });

    await this.issuesHistoryService.recordBulkIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueIds: updated.map((issue) => issue.id),
      actorUserId: input.actorUserId,
      activityType: "issue.assignee_changed",
      activityPayload: {
        assignedUserId: input.assignedUserId ?? null,
        bulk: true,
      },
      auditAction: "issue.assignee.bulk_update",
      auditPayload: {
        issueIds: input.issueIds,
        assignedUserId: input.assignedUserId ?? null,
        updatedCount: updated.length,
      },
    });

    return { success: true, updatedCount: updated.length };
  }

  async listComments(projectId: string, issueId: string) {
    await this.assertIssue(projectId, issueId);

    return this.db
      .select()
      .from(issueComments)
      .where(and(eq(issueComments.projectId, projectId), eq(issueComments.issueId, issueId)))
      .orderBy(asc(issueComments.createdAt));
  }

  async createComment(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId: string;
    body: string;
  }) {
    await this.assertIssue(input.projectId, input.issueId);

    const [comment] = await this.db
      .insert(issueComments)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        issueId: input.issueId,
        userId: input.actorUserId,
        body: input.body,
      })
      .returning();

    await this.issuesHistoryService.recordCommentCreation({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      commentId: comment.id,
    });

    return comment;
  }

  async listActivity(projectId: string, issueId: string) {
    await this.assertIssue(projectId, issueId);

    return this.db
      .select()
      .from(issueActivity)
      .where(and(eq(issueActivity.projectId, projectId), eq(issueActivity.issueId, issueId)))
      .orderBy(desc(issueActivity.createdAt));
  }

  private async assertIssue(projectId: string, issueId: string) {
    const [issue] = await this.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.id, issueId)))
      .limit(1);

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }
  }

  private async assertIssueRecord(projectId: string, issueId: string) {
    const [issue] = await this.db
      .select()
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.id, issueId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");
    return issue;
  }

  private async assertAssignableMember(organizationId: string, assignedUserId?: string | null) {
    if (!assignedUserId) {
      return;
    }

    const [membership] = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, assignedUserId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new NotFoundException("Assignee is not a member of the organization");
    }
  }
}
