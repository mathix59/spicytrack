import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { environments, events, issues, releases, users } from "../database/schema";
import type { DatabaseClient } from "../database/database.provider";
import type { IssueSearchTerm } from "./issue-search";

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

type IssueListFilterInput = {
  projectId: string;
  /** Parsed `q` search terms. */
  search?: IssueSearchTerm[];
  /** Resolves `assigned:me`. */
  currentUserId?: string;
  level?: string;
  priority?: string;
  status?: string;
  assignedUserId?: string;
  isRegressed?: boolean;
  environment?: string;
  release?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ILIKE pattern matching `value` literally, with `*` as the only wildcard when allowed. */
function likePattern(value: string, { wildcards }: { wildcards: boolean }) {
  const escaped = value.replace(/[\\%_]/g, (character) => `\\${character}`);
  return wildcards ? escaped.replaceAll("*", "%") : `%${escaped}%`;
}

/** Ids of the project's issues having at least one event matching `where`. */
function issuesWithEvents(db: DatabaseClient, projectId: string, where: SQL) {
  return db
    .select({ issueId: events.issueId })
    .from(events)
    .where(and(eq(events.projectId, projectId), where));
}

// The environment / release id is resolved first so the events lookup is an index-only scan
// of (project_id, environment_id|release_id, issue_id).
function environmentCondition(db: DatabaseClient, projectId: string, name: string) {
  const environmentIds = db
    .select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.name, name)));
  return inArray(
    issues.id,
    issuesWithEvents(db, projectId, inArray(events.environmentId, environmentIds)),
  );
}

function releaseCondition(db: DatabaseClient, projectId: string, version: string) {
  const releaseIds = db
    .select({ id: releases.id })
    .from(releases)
    .where(and(eq(releases.projectId, projectId), eq(releases.version, version)));
  return inArray(issues.id, issuesWithEvents(db, projectId, inArray(events.releaseId, releaseIds)));
}

function searchTermCondition(
  db: DatabaseClient,
  input: IssueListFilterInput,
  term: IssueSearchTerm,
): SQL {
  const { projectId } = input;

  switch (term.kind) {
    case "text": {
      const pattern = likePattern(term.value, { wildcards: false });
      const matches = [
        ilike(issues.title, pattern),
        ilike(issues.culprit, pattern),
        ilike(issues.groupingKey, pattern),
      ];
      if (UUID_PATTERN.test(term.value)) matches.push(eq(issues.id, term.value.toLowerCase()));
      return or(...matches)!;
    }
    case "is":
      switch (term.value) {
        case "unresolved":
          return eq(issues.status, "open");
        case "resolved":
        case "ignored":
          return eq(issues.status, term.value);
        case "regressed":
          return eq(issues.isRegressed, true);
        case "assigned":
          return isNotNull(issues.assignedUserId);
        case "unassigned":
          return isNull(issues.assignedUserId);
      }
      break;
    case "level":
      return eq(issues.level, term.value);
    case "priority":
      return eq(issues.priority, term.value);
    case "environment":
      return environmentCondition(db, projectId, term.value);
    case "release":
      return releaseCondition(db, projectId, term.value);
    case "assigned":
      if (term.value === "none") return isNull(issues.assignedUserId);
      if (term.value === "me") {
        return input.currentUserId ? eq(issues.assignedUserId, input.currentUserId) : sql`false`;
      }
      return inArray(
        issues.assignedUserId,
        db
          .select({ id: users.id })
          .from(users)
          .where(eq(sql`lower(${users.email})`, term.value.email)),
      );
    case "has":
      return inArray(issues.id, issuesWithEvents(db, projectId, sql`${events.tags} ? ${term.key}`));
    case "tag": {
      // Exact values use the GIN index on tags; `*` patterns scan the project's events.
      const matches = term.value.includes("*")
        ? ilike(
            sql<string>`${events.tags} ->> ${term.key}`,
            likePattern(term.value, { wildcards: true }),
          )
        : sql`${events.tags} @> ${JSON.stringify({ [term.key]: term.value })}::jsonb`;
      return inArray(issues.id, issuesWithEvents(db, projectId, matches));
    }
    case "age":
    case "lastSeen": {
      const column = term.kind === "age" ? issues.firstSeenAt : issues.lastSeenAt;
      return term.comparison === "newer" ? gte(column, term.since) : lt(column, term.since);
    }
    case "timesSeen": {
      const compare = { ">": gt, ">=": gte, "<": lt, "<=": lte, "=": eq }[term.operator];
      return compare(issues.timesSeen, term.count);
    }
  }
}

function buildIssueListFilters(db: DatabaseClient, input: IssueListFilterInput) {
  const filters: SQL[] = [eq(issues.projectId, input.projectId)];

  for (const term of input.search ?? []) {
    const condition = searchTermCondition(db, input, term);
    filters.push("negated" in term && term.negated ? not(condition) : condition);
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
    filters.push(environmentCondition(db, input.projectId, input.environment));
  }

  if (input.release) {
    filters.push(releaseCondition(db, input.projectId, input.release));
  }

  return filters;
}

type IssueSortInput = {
  sortBy?: "lastSeenAt" | "firstSeenAt" | "timesSeen";
  sortDir?: "asc" | "desc";
};

function issueSortColumn(input?: IssueSortInput) {
  const sortBy = input?.sortBy ?? "lastSeenAt";
  return sortBy === "firstSeenAt"
    ? issues.firstSeenAt
    : sortBy === "timesSeen"
      ? issues.timesSeen
      : issues.lastSeenAt;
}

/** Sort order with the id as tie-breaker, so pages and neighbours are stable. */
function resolveIssueSortOrder(input?: IssueSortInput, { reverse = false } = {}) {
  const descending = ((input?.sortDir ?? "desc") === "desc") !== reverse;
  const direction = descending ? desc : asc;
  return [direction(issueSortColumn(input)), direction(issues.id)];
}

/**
 * Issues after (or before) a given position in the sort order. Keyset rather than row numbers, so
 * the neighbours of an issue that no longer matches the filters (just resolved, say) still exist.
 */
function issuesAfterPosition(
  input: IssueSortInput,
  position: { sortValue: Date | number; id: string },
  { before = false } = {},
) {
  const descending = (input.sortDir ?? "desc") === "desc";
  const operator = descending !== before ? sql.raw("<") : sql.raw(">");
  const sortValue =
    position.sortValue instanceof Date
      ? sql`${position.sortValue.toISOString()}::timestamptz`
      : sql`${position.sortValue}::integer`;
  return sql`(${issueSortColumn(input)}, ${issues.id}) ${operator} (${sortValue}, ${position.id}::uuid)`;
}

export {
  buildIssueListFilters,
  eventSelect,
  issueSortColumn,
  issuesAfterPosition,
  resolveIssueSortOrder,
};
export type { IssueListFilterInput, IssueSortInput };
