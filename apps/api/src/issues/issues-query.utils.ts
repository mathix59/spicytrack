import { and, asc, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

import { environments, events, issues, releases } from "../database/schema";
import type { DatabaseClient } from "../database/database.provider";

const eventSelect = {
  id: events.id,
  organizationId: events.organizationId,
  projectId: events.projectId,
  issueId: events.issueId,
  eventId: events.eventId,
  environmentId: events.environmentId,
  environmentName: environments.name,
  releaseId: events.releaseId,
  releaseVersion: releases.version,
  platform: events.platform,
  sdkName: events.sdkName,
  level: events.level,
  message: events.message,
  timestamp: events.timestamp,
  rawPayload: events.rawPayload,
} as const;

function buildIssueListFilters(
  db: DatabaseClient,
  input: {
    projectId: string;
    q?: string;
    level?: string;
    priority?: string;
    status?: string;
    assignedUserId?: string;
    isRegressed?: boolean;
    environment?: string;
    release?: string;
  },
) {
  const filters = [eq(issues.projectId, input.projectId)];

  if (input.q) {
    const pattern = `%${input.q}%`;
    filters.push(or(ilike(issues.title, pattern), ilike(issues.groupingKey, pattern))!);
  }

  if (input.level) {
    filters.push(eq(issues.level, input.level));
  }

  if (input.priority) {
    filters.push(eq(issues.priority, input.priority));
  }

  if (input.status) {
    filters.push(eq(issues.status, input.status));
  }

  if (input.assignedUserId === "__unassigned__") {
    filters.push(isNull(issues.assignedUserId));
  } else if (input.assignedUserId) {
    filters.push(eq(issues.assignedUserId, input.assignedUserId));
  }

  if (input.isRegressed !== undefined) {
    filters.push(eq(issues.isRegressed, input.isRegressed));
  }

  if (input.environment) {
    filters.push(
      inArray(
        issues.id,
        db
          .select({ issueId: events.issueId })
          .from(events)
          .innerJoin(environments, eq(events.environmentId, environments.id))
          .where(
            and(eq(events.projectId, input.projectId), eq(environments.name, input.environment)),
          ),
      ),
    );
  }

  if (input.release) {
    filters.push(
      inArray(
        issues.id,
        db
          .select({ issueId: events.issueId })
          .from(events)
          .innerJoin(releases, eq(events.releaseId, releases.id))
          .where(and(eq(events.projectId, input.projectId), eq(releases.version, input.release))),
      ),
    );
  }

  return filters;
}

function resolveIssueSortOrder(input?: {
  sortBy?: "lastSeenAt" | "firstSeenAt" | "timesSeen";
  sortDir?: "asc" | "desc";
}) {
  const sortBy = input?.sortBy ?? "lastSeenAt";
  const sortDir = input?.sortDir ?? "desc";
  const sortColumn =
    sortBy === "firstSeenAt"
      ? issues.firstSeenAt
      : sortBy === "timesSeen"
        ? issues.timesSeen
        : issues.lastSeenAt;

  return sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);
}

export { buildIssueListFilters, eventSelect, resolveIssueSortOrder };
