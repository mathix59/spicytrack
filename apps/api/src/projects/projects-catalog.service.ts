import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc as drizzleDesc, eq, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { environments, events, issues, releases } from "../database/schema";

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

    const impactedIssues = await this.db
      .selectDistinct({
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
      .from(events)
      .innerJoin(issues, eq(events.issueId, issues.id))
      .where(eq(events.releaseId, release.id))
      .orderBy(drizzleDesc(issues.lastSeenAt));

    return {
      release,
      issues: impactedIssues,
    };
  }
}
