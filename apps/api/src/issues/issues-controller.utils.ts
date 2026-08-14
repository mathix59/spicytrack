import { BadRequestException } from "@nestjs/common";

import { assertString } from "../common/validators";

type IssuePriority = "low" | "medium" | "high" | "critical";
type IssueSortBy = "lastSeenAt" | "firstSeenAt" | "timesSeen";
type IssueSortDir = "asc" | "desc";

function parseIssueListQuery(input: {
  page?: string;
  pageSize?: string;
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
}) {
  return {
    page: normalizePositiveInt(input.page, 1, "page"),
    pageSize: normalizePositiveInt(input.pageSize, 25, "pageSize", 100),
    q: normalizeOptionalQuery(input.q),
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

function parseIssueEventPagination(input: { eventPage?: string; eventPageSize?: string }) {
  return {
    eventPage: normalizePositiveInt(input.eventPage, 1, "eventPage"),
    eventPageSize: normalizePositiveInt(input.eventPageSize, 20, "eventPageSize", 100),
  };
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
  return {
    status: assertString(body.status, "status"),
    ignoredUntil,
  };
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
  return {
    issueIds: assertStringArray(body.issueIds, "issueIds"),
    status: assertString(body.status, "status"),
  };
}

function parseBulkIssuePriorityBody(body: Record<string, unknown>) {
  return {
    issueIds: assertStringArray(body.issueIds, "issueIds"),
    priority: assertPriority(assertString(body.priority, "priority")),
  };
}

function parseBulkIssueAssigneeBody(body: Record<string, unknown>) {
  return {
    issueIds: assertStringArray(body.issueIds, "issueIds"),
    assignedUserId: parseNullableString(body.assignedUserId, "assignedUserId"),
  };
}

function parseCreateCommentBody(body: Record<string, unknown>) {
  return {
    body: assertString(body.body, "body"),
  };
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
  return { targetIssueId: assertString(body.targetIssueId, "targetIssueId") };
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
  parseIssueListQuery,
  parseIssuePriorityBody,
  parseIssueStatusBody,
  parseIssueExternalLinkBody,
  parseMergeIssueBody,
};
