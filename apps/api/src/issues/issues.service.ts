import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

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
import type { IssueSearchTerm } from "./issue-search";
import { summarizeTagCounts, TAG_BREAKDOWN_SAMPLE } from "./issue-tags";
import {
  buildIssueListFilters,
  eventSelect,
  issueSortColumn,
  issuesAfterPosition,
  resolveIssueSortOrder,
} from "./issues-query.utils";
import type { IssueListFilterInput, IssueSortInput } from "./issues-query.utils";

export const ISSUE_STATUSES = ["open", "resolved", "ignored"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type IssueResolution = "now" | "next_release";
/** Most issues a bulk action can change when it targets every result of a search. */
export const MAX_BULK_FILTER_ISSUES = 5_000;
export type IssueListQuery = Omit<IssueListFilterInput, "projectId"> & IssueSortInput;
export type BulkIssueSelection = { issueIds: string[] } | { filters: IssueListQuery };

type ResolutionRelease = { id: string; version: string } | null;

/** Columns that change with the status; only a resolution records who resolved and when. */
function statusChange(status: IssueStatus, actorUserId: string, release: ResolutionRelease = null) {
  const resolved = status === "resolved";
  return {
    status,
    resolvedAt: resolved ? new Date() : null,
    resolvedByUserId: resolved ? actorUserId : null,
    resolvedInReleaseId: resolved ? (release?.id ?? null) : null,
    updatedAt: new Date(),
  };
}

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
    search?: IssueSearchTerm[];
    currentUserId?: string;
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
        .orderBy(...sortOrder)
        .limit(input.pageSize)
        .offset(offset),
    ]);

    const userCounts = await this.countUsers(items.map((issue) => issue.id));

    return {
      items: items.map((issue) => ({ ...issue, userCount: userCounts.get(issue.id) ?? 0 })),
      total: totalRow[0]?.value ?? 0,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  /** The issues before and after this one in a filtered, sorted list (for j/k navigation). */
  async getNeighbors(input: { projectId: string; issueId: string } & IssueListQuery) {
    const [current] = await this.db
      .select({ id: issues.id, sortValue: issueSortColumn(input) })
      .from(issues)
      .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
      .limit(1);
    if (!current) throw new NotFoundException("Issue not found");

    const filters = buildIssueListFilters(this.db, input);
    const neighbor = async (before: boolean) => {
      const [row] = await this.db
        .select({ id: issues.id })
        .from(issues)
        .where(and(...filters, issuesAfterPosition(input, current, { before })))
        .orderBy(...resolveIssueSortOrder(input, { reverse: before }))
        .limit(1);
      return row?.id ?? null;
    };
    const [previousIssueId, nextIssueId] = await Promise.all([neighbor(true), neighbor(false)]);

    return { previousIssueId, nextIssueId };
  }

  /** Issue ids for a bulk action: the explicit selection, or every issue matching a search. */
  async selectIssueIds(projectId: string, selection: BulkIssueSelection) {
    if ("issueIds" in selection) return selection.issueIds;

    const rows = await this.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(...buildIssueListFilters(this.db, { ...selection.filters, projectId })))
      .orderBy(...resolveIssueSortOrder(selection.filters))
      .limit(MAX_BULK_FILTER_ISSUES + 1);
    if (rows.length > MAX_BULK_FILTER_ISSUES) {
      throw new BadRequestException(
        `This search matches more than ${MAX_BULK_FILTER_ISSUES} issues; narrow it down first`,
      );
    }
    return rows.map((row) => row.id);
  }

  /** Distinct users (id, email or username) seen in each issue's events. */
  private async countUsers(issueIds: string[]): Promise<Map<string, number>> {
    if (issueIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        issueId: events.issueId,
        users: sql<number>`count(distinct ${events.userIdentifier})::int`,
      })
      .from(events)
      .where(inArray(events.issueId, issueIds))
      .groupBy(events.issueId);
    return new Map(rows.map((row) => [row.issueId, row.users]));
  }

  async getTagBreakdown(projectId: string, issueId: string) {
    await this.assertIssueRecord(projectId, issueId);
    const recent = this.db
      .select({ tags: events.tags })
      .from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(desc(events.timestamp))
      .limit(TAG_BREAKDOWN_SAMPLE)
      .as("recent");
    const [rows, [sampled]] = await Promise.all([
      this.db
        .select({
          key: sql<string>`tag.key`,
          value: sql<string>`tag.value`,
          count: sql<number>`count(*)::int`,
        })
        .from(sql`${recent}, jsonb_each_text(${recent.tags}) as tag`)
        .groupBy(sql`tag.key`, sql`tag.value`),
      this.db.select({ value: count() }).from(recent),
    ]);
    return summarizeTagCounts(rows, sampled?.value ?? 0);
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

    const [userCounts, resolvedInRelease] = await Promise.all([
      this.countUsers([issue.id]),
      issue.resolvedInReleaseId
        ? this.db
            .select({ version: releases.version })
            .from(releases)
            .where(eq(releases.id, issue.resolvedInReleaseId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return {
      issue: {
        ...issue,
        userCount: userCounts.get(issue.id) ?? 0,
        resolvedInReleaseVersion: resolvedInRelease[0]?.version ?? null,
      },
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
    status: IssueStatus;
    actorUserId: string;
    ignoredUntil?: Date | null;
    resolution?: IssueResolution;
  }) {
    const current = await this.assertIssueRecord(input.projectId, input.issueId);
    if (current.mergedIntoIssueId) {
      throw new BadRequestException("Unmerge this issue before changing its status");
    }
    const release = await this.resolutionRelease(input.projectId, input.resolution);
    const [issue] = await this.db
      .update(issues)
      .set({
        ...statusChange(input.status, input.actorUserId, release),
        ignoredUntil: input.status === "ignored" ? (input.ignoredUntil ?? null) : null,
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
      activityPayload: {
        status: input.status,
        ignoredUntil: input.ignoredUntil ?? null,
        ...(release ? { resolvedInRelease: release.version } : {}),
      },
      auditAction: "issue.status.update",
      auditPayload: {
        status: input.status,
        ignoredUntil: input.ignoredUntil ?? null,
        ...(release ? { resolvedInRelease: release.version } : {}),
      },
    });

    return { ...issue, resolvedInReleaseVersion: release?.version ?? null };
  }

  /** The release a "next release" resolution waits past: the project's latest one. */
  private async resolutionRelease(
    projectId: string,
    resolution: IssueResolution | undefined,
  ): Promise<ResolutionRelease> {
    if (resolution !== "next_release") return null;
    const [latest] = await this.db
      .select({ id: releases.id, version: releases.version })
      .from(releases)
      .where(eq(releases.projectId, projectId))
      .orderBy(desc(releases.createdAt))
      .limit(1);
    if (!latest) {
      throw new BadRequestException(
        "This project has no release yet: send events with a release to resolve in the next one",
      );
    }
    return latest;
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
      // Each moved event remembers the issue it came from (unless an earlier merge already set it),
      // which is what lets unmerge give it back.
      await tx
        .update(events)
        .set({
          issueId: target.id,
          mergedFromIssueId: sql`coalesce(${events.mergedFromIssueId}, ${source.id})`,
        })
        .where(eq(events.issueId, source.id));
      // Issues previously merged into the source now follow it into the target, so new events
      // never land on an issue in "merged" status.
      await tx
        .update(issues)
        .set({ mergedIntoIssueId: target.id, updatedAt: new Date() })
        .where(eq(issues.mergedIntoIssueId, source.id));
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
    const targetIssueId = currentIssue.mergedIntoIssueId;
    const { issue, movedEventCount } = await this.db.transaction(async (tx) => {
      // Give back the events that were grouped into this issue before (or after) the merge.
      const moved = await tx
        .update(events)
        .set({ issueId: input.issueId, mergedFromIssueId: null })
        .where(and(eq(events.issueId, targetIssueId), eq(events.mergedFromIssueId, input.issueId)))
        .returning({ id: events.id });
      const [restored] = await tx
        .update(issues)
        .set({ status: "open", mergedIntoIssueId: null, updatedAt: new Date() })
        .where(and(eq(issues.projectId, input.projectId), eq(issues.id, input.issueId)))
        .returning();
      if (!restored) return { issue: undefined, movedEventCount: 0 };

      await this.recomputeIssueStats(tx, input.issueId, { minimumTimesSeen: moved.length });
      await this.recomputeIssueStats(tx, targetIssueId, { subtractTimesSeen: moved.length });
      const [issue] = await tx.select().from(issues).where(eq(issues.id, input.issueId));
      return { issue, movedEventCount: moved.length };
    });
    if (!issue) throw new NotFoundException("Issue not found");
    await this.issuesHistoryService.recordIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: input.issueId,
      actorUserId: input.actorUserId,
      activityType: "issue.unmerged",
      activityPayload: { targetIssueId, movedEventCount },
      auditAction: "issue.unmerge",
      auditPayload: { targetIssueId, movedEventCount },
    });
    return issue;
  }

  /**
   * Re-derives first/last seen and the last event from the events an issue holds after events
   * moved between issues. timesSeen is adjusted, not recounted, because retention may already
   * have deleted older events.
   */
  private async recomputeIssueStats(
    tx: Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0],
    issueId: string,
    adjust: { minimumTimesSeen?: number; subtractTimesSeen?: number },
  ) {
    const [stats] = await tx
      .select({
        eventCount: count(),
        firstSeenAt: sql<Date | null>`min(${events.timestamp})`,
        lastSeenAt: sql<Date | null>`max(${events.timestamp})`,
      })
      .from(events)
      .where(eq(events.issueId, issueId));
    const [lastEvent] = await tx
      .select({ id: events.id })
      .from(events)
      .where(eq(events.issueId, issueId))
      .orderBy(desc(events.timestamp))
      .limit(1);
    const eventCount = stats?.eventCount ?? 0;
    const timesSeen =
      adjust.subtractTimesSeen !== undefined
        ? sql`greatest(${issues.timesSeen} - ${adjust.subtractTimesSeen}, ${eventCount})`
        : sql`greatest(${issues.timesSeen}, ${adjust.minimumTimesSeen ?? 0}, ${eventCount})`;

    await tx
      .update(issues)
      .set({
        timesSeen,
        ...(stats?.firstSeenAt ? { firstSeenAt: new Date(stats.firstSeenAt) } : {}),
        ...(stats?.lastSeenAt ? { lastSeenAt: new Date(stats.lastSeenAt) } : {}),
        lastEventId: lastEvent?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));
  }

  async bulkUpdateStatus(input: {
    organizationId: string;
    projectId: string;
    issueIds: string[];
    status: IssueStatus;
    actorUserId: string;
    resolution?: IssueResolution;
  }) {
    if (input.issueIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const release = await this.resolutionRelease(input.projectId, input.resolution);
    const updated = await this.db
      .update(issues)
      .set({
        ...statusChange(input.status, input.actorUserId, release),
        // Bulk ignore has no end date: the issue stays ignored until someone reopens it.
        ignoredUntil: null,
      })
      .where(
        and(
          eq(issues.projectId, input.projectId),
          inArray(issues.id, input.issueIds),
          isNull(issues.mergedIntoIssueId),
        ),
      )
      .returning({ id: issues.id });

    await this.issuesHistoryService.recordBulkIssueChange({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueIds: updated.map((issue) => issue.id),
      actorUserId: input.actorUserId,
      activityType: "issue.status_changed",
      activityPayload: {
        status: input.status,
        bulk: true,
        ...(release ? { resolvedInRelease: release.version } : {}),
      },
      auditAction: "issue.status.bulk_update",
      auditPayload: {
        issueIds: input.issueIds,
        status: input.status,
        ...(release ? { resolvedInRelease: release.version } : {}),
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
