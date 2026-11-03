import { BadRequestException } from "@nestjs/common";

import { isEventTrendPeriod } from "../common/event-trends.utils";
import type { EventTrendPeriod } from "../common/event-trends.utils";
import { assertOneOf, assertString } from "../common/validators";
import { parseIssueSearch } from "./issue-search";

type IssuePriority = "low" | "medium" | "high" | "critical";
type IssueSortBy = "lastSeenAt" | "firstSeenAt" | "timesSeen";
type IssueSortDir = "asc" | "desc";

const MAX_ISSUE_TREND_IDS = 100;
const MAX_BULK_ISSUE_IDS = 500;
const MAX_COMMENT_LENGTH = 10_000;
const ISSUE_STATUSES = ["open", "resolved", "ignored"] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IssueListQueryInput = {
  q?: string;
  level?: string;
  priority?: string;
  status?: string;
  assignedUserId?: string;
  isRegressed?: string;
  environment?: string;
  release?: string;
  sortBy?: string;
  sortDir?: string;
};

/** Filters and sort shared by the issue list, j/k neighbours and "select all" bulk actions. */
function parseIssueFilters(input: IssueListQueryInput) {
  return {
    search: parseIssueSearch(normalizeOptionalQuery(input.q) ?? ""),
    level: normalizeOptionalQuery(input.level),
    priority: normalizePriority(input.priority),
    status: normalizeOptionalQuery(input.status),
    assignedUserId: normalizeOptionalQuery(input.assignedUserId),
    isRegressed: normalizeOptionalBoolean(input.isRegressed, "isRegressed"),
    environment: normalizeOptionalQuery(input.environment),
    release: normalizeOptionalQuery(input.release),
    sortBy: normalizeSortBy(input.sortBy),
    sortDir: normalizeSortDir(input.sortDir),
  };
}

function parseIssueListQuery(input: IssueListQueryInput & { page?: string; pageSize?: string }) {
  return {
    page: normalizePositiveInt(input.page, 1, "page"),
    pageSize: normalizePositiveInt(input.pageSize, 25, "pageSize", 100),
    ...parseIssueFilters(input),
  };
}

function parseIssueEventPagination(input: { eventPage?: string; eventPageSize?: string }) {
  return {
    eventPage: normalizePositiveInt(input.eventPage, 1, "eventPage"),
    eventPageSize: normalizePositiveInt(input.eventPageSize, 20, "eventPageSize", 100),
  };
}

function parseIssueTrendsQuery(input: { issueIds?: string; period?: string }) {
  return {
    issueIds: parseIssueTrendIds(input.issueIds),
    period: parseIssueTrendPeriod(input.period),
  };
}

function parseIssueTrendIds(value: string | undefined) {
  const issueIds = [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  ];

  if (issueIds.length === 0) {
    throw new BadRequestException("issueIds must contain at least one issue id");
  }

  if (issueIds.length > MAX_ISSUE_TREND_IDS) {
    throw new BadRequestException(`issueIds must contain at most ${MAX_ISSUE_TREND_IDS} issue ids`);
  }

  if (issueIds.some((issueId) => !UUID_REGEX.test(issueId))) {
    throw new BadRequestException("issueIds must be a comma-separated list of UUIDs");
  }

  return issueIds;
}

function parseIssueTrendPeriod(value: string | undefined): EventTrendPeriod {
  if (value === undefined || value === "") {
    return "24h";
  }

  if (isEventTrendPeriod(value)) {
    return value;
  }

  throw new BadRequestException("period must be 24h or 14d");
}

function parseIssueStatusBody(body: Record<string, unknown>) {
  const ignoredUntilValue = parseNullableString(body.ignoredUntil, "ignoredUntil");
  let ignoredUntil: Date | null | undefined;
  if (typeof ignoredUntilValue === "string") {
    ignoredUntil = new Date(ignoredUntilValue);
  } else {
    ignoredUntil = ignoredUntilValue;
  }
  if (ignoredUntil instanceof Date && Number.isNaN(ignoredUntil.getTime())) {
    throw new BadRequestException("ignoredUntil must be an ISO date or null");
  }
  // A past date would reopen the issue on its very next event.
  if (ignoredUntil instanceof Date && ignoredUntil.getTime() <= Date.now()) {
    throw new BadRequestException("ignoredUntil must be in the future");
  }
  const status = assertOneOf(body.status, ISSUE_STATUSES, "status");
  return { status, ignoredUntil, resolution: parseResolution(body.resolution, status) };
}

const ISSUE_RESOLUTIONS = ["now", "next_release"] as const;

function parseResolution(value: unknown, status: string) {
  if (value === undefined || value === null) return "now" as const;
  const resolution = assertOneOf(value, ISSUE_RESOLUTIONS, "resolution");
  if (resolution === "next_release" && status !== "resolved") {
    throw new BadRequestException('resolution "next_release" requires status "resolved"');
  }
  return resolution;
}

function parseIssuePriorityBody(body: Record<string, unknown>) {
  return {
    priority: assertPriority(assertString(body.priority, "priority")),
  };
}

function parseIssueAssigneeBody(body: Record<string, unknown>) {
  return {
    assignedUserId: parseNullableString(body.assignedUserId, "assignedUserId"),
  };
}

function parseBulkIssueStatusBody(body: Record<string, unknown>) {
  const status = assertOneOf(body.status, ISSUE_STATUSES, "status");
  return {
    selection: parseBulkSelection(body),
    status,
    resolution: parseResolution(body.resolution, status),
  };
}

function parseBulkIssuePriorityBody(body: Record<string, unknown>) {
  return {
    selection: parseBulkSelection(body),
    priority: assertPriority(assertString(body.priority, "priority")),
  };
}

function parseBulkIssueAssigneeBody(body: Record<string, unknown>) {
  return {
    selection: parseBulkSelection(body),
    assignedUserId: parseNullableString(body.assignedUserId, "assignedUserId"),
  };
}

function parseCreateCommentBody(body: Record<string, unknown>) {
  const comment = assertString(body.body, "body");
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new BadRequestException(`body must be at most ${MAX_COMMENT_LENGTH} characters`);
  }
  return { body: comment };
}

function parseIssueExternalLinkBody(body: Record<string, unknown>) {
  const externalIssueUrl = parseNullableString(body.externalIssueUrl, "externalIssueUrl");
  if (externalIssueUrl) {
    try {
      const url = new URL(externalIssueUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch {
      throw new BadRequestException("externalIssueUrl must be an http(s) URL or null");
    }
  }
  return { externalIssueUrl };
}

function parseMergeIssueBody(body: Record<string, unknown>) {
  const targetIssueId = assertString(body.targetIssueId, "targetIssueId");
  if (!UUID_REGEX.test(targetIssueId)) {
    throw new BadRequestException("targetIssueId must be an issue ID");
  }
  return { targetIssueId };
}

/** Bulk actions take issue UUIDs, deduplicated and capped so one request stays bounded. */
const BULK_FILTER_KEYS = [
  "q",
  "level",
  "priority",
  "status",
  "assignedUserId",
  "isRegressed",
  "environment",
  "release",
  "sortBy",
  "sortDir",
] as const;

/** A bulk action targets either `issueIds` or every issue matching `filters`. */
function parseBulkSelection(body: Record<string, unknown>) {
  if (body.filters === undefined) return { issueIds: assertIssueIds(body.issueIds) };
  if (body.issueIds !== undefined) {
    throw new BadRequestException("Send either issueIds or filters, not both");
  }
  if (typeof body.filters !== "object" || body.filters === null || Array.isArray(body.filters)) {
    throw new BadRequestException("filters must be an object");
  }

  const raw = body.filters as Record<string, unknown>;
  const filters: IssueListQueryInput = {};
  for (const key of BULK_FILTER_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" && typeof value !== "boolean") {
      throw new BadRequestException(`filters.${key} must be a string`);
    }
    filters[key] = String(value);
  }
  return { filters: parseIssueFilters(filters) };
}

function assertIssueIds(value: unknown) {
  const issueIds = [...new Set(assertStringArray(value, "issueIds"))];
  if (issueIds.length > MAX_BULK_ISSUE_IDS) {
    throw new BadRequestException(`issueIds accepts at most ${MAX_BULK_ISSUE_IDS} issues`);
  }
  if (issueIds.some((issueId) => !UUID_REGEX.test(issueId))) {
    throw new BadRequestException("issueIds must contain issue IDs");
  }
  return issueIds;
}

function assertStringArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new BadRequestException(`${fieldName} must be an array of strings`);
  }

  return value.map((entry) => entry as string);
}

function parseNullableString(value: unknown, fieldName: string) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  return assertString(value, fieldName);
}

function normalizePositiveInt(
  value: string | undefined,
  fallback: number,
  fieldName: string,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new BadRequestException(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function normalizeOptionalQuery(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizePriority(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  return assertPriority(value);
}

function assertPriority(value: string): IssuePriority {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  throw new BadRequestException("priority must be low, medium, high or critical");
}

function normalizeOptionalBoolean(value: string | undefined, fieldName: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new BadRequestException(`${fieldName} must be true or false`);
}

function normalizeSortBy(value: string | undefined): IssueSortBy | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "lastSeenAt" || value === "firstSeenAt" || value === "timesSeen") {
    return value;
  }

  throw new BadRequestException("sortBy must be one of lastSeenAt, firstSeenAt, timesSeen");
}

function normalizeSortDir(value: string | undefined): IssueSortDir | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "asc" || value === "desc") {
    return value;
  }

  throw new BadRequestException("sortDir must be asc or desc");
}

export {
  parseBulkIssueAssigneeBody,
  parseBulkIssuePriorityBody,
  parseBulkIssueStatusBody,
  parseCreateCommentBody,
  parseIssueAssigneeBody,
  parseIssueEventPagination,
  parseIssueFilters,
  parseIssueListQuery,
  parseIssuePriorityBody,
  parseIssueStatusBody,
  parseIssueExternalLinkBody,
  parseIssueTrendsQuery,
  parseMergeIssueBody,
  MAX_ISSUE_TREND_IDS,
};
