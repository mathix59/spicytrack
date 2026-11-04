import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc as drizzleDesc, eq, inArray, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { environments, events, issues, releases } from "../database/schema";

/** A release lists its most frequent issues; the issue list filtered by release has the rest. */
export const RELEASE_TOP_ISSUES = 10;

@Injectable()
export class ProjectsCatalogService {
  constructor(@Inject(DATABASE) private readonly db: DatabaseClient) {}

  async listEnvironments(projectId: string) {
    return this.db
      .select({
        id: environments.id,
        organizationId: environments.organizationId,
        projectId: environments.projectId,
        name: environments.name,
        eventCount: count(events.id),
        lastSeenAt: sql<Date | null>`MAX(${events.timestamp})`,
        createdAt: environments.createdAt,
      })
      .from(environments)
      .leftJoin(events, eq(events.environmentId, environments.id))
      .where(eq(environments.projectId, projectId))
      .groupBy(environments.id)
      .orderBy(drizzleDesc(sql`MAX(${events.timestamp})`), drizzleDesc(environments.createdAt));
  }

  async listReleases(projectId: string) {
    return this.db
      .select({
        id: releases.id,
        organizationId: releases.organizationId,
        projectId: releases.projectId,
        version: releases.version,
        eventCount: count(events.id),
        firstSeenAt: releases.firstSeenAt,
        lastSeenAt: releases.lastSeenAt,
        createdAt: releases.createdAt,
        updatedAt: releases.updatedAt,
      })
      .from(releases)
      .leftJoin(events, eq(events.releaseId, releases.id))
      .where(eq(releases.projectId, projectId))
      .groupBy(releases.id)
      .orderBy(drizzleDesc(releases.lastSeenAt), drizzleDesc(releases.createdAt));
  }

  async getReleaseDetail(input: { projectId: string; releaseVersion: string }) {
    const [release] = await this.db
      .select({
        id: releases.id,
        organizationId: releases.organizationId,
        projectId: releases.projectId,
        version: releases.version,
        eventCount: count(events.id),
        firstSeenAt: releases.firstSeenAt,
        lastSeenAt: releases.lastSeenAt,
        createdAt: releases.createdAt,
        updatedAt: releases.updatedAt,
      })
      .from(releases)
      .leftJoin(events, eq(events.releaseId, releases.id))
      .where(
        and(eq(releases.projectId, input.projectId), eq(releases.version, input.releaseVersion)),
      )
      .groupBy(releases.id)
      .limit(1);

    if (!release) {
      throw new NotFoundException("Release not found");
    }

    const releaseIssueIds = this.db
      .selectDistinct({ issueId: events.issueId })
      .from(events)
      .where(eq(events.releaseId, release.id));
    const inRelease = inArray(issues.id, releaseIssueIds);

    const [impactedIssues, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: issues.id,
          organizationId: issues.organizationId,
          projectId: issues.projectId,
          groupingKey: issues.groupingKey,
          title: issues.title,
          level: issues.level,
          status: issues.status,
          firstSeenAt: issues.firstSeenAt,
          lastSeenAt: issues.lastSeenAt,
          timesSeen: issues.timesSeen,
          assignedUserId: issues.assignedUserId,
        })
        .from(issues)
        .where(inRelease)
        .orderBy(drizzleDesc(issues.timesSeen), drizzleDesc(issues.lastSeenAt), issues.id)
        .limit(RELEASE_TOP_ISSUES),
      this.db.select({ total: count() }).from(issues).where(inRelease),
    ]);

    return {
      release,
      issues: impactedIssues,
      issuesTotal: total,
    };
  }
}
