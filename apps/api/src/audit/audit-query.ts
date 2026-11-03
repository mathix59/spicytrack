import { BadRequestException } from "@nestjs/common";

export const AUDIT_PAGE_SIZE = 50;
export const MAX_AUDIT_PAGE_SIZE = 200;
export const MAX_AUDIT_EXPORT_ROWS = 10_000;

export interface AuditFilters {
  /** Exact action, or a prefix when it ends with "." (e.g. "member."). */
  action?: string;
  actorUserId?: string;
  projectId?: string;
  targetType?: string;
  from?: Date;
  to?: Date;
}

export interface AuditCursor {
  createdAt: string;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalString(value: unknown, name: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new BadRequestException(`${name} is invalid`);
  }
  return value.trim() || undefined;
}

function optionalUuid(value: unknown, name: string) {
  const text = optionalString(value, name, 36);
  if (text !== undefined && !UUID.test(text)) throw new BadRequestException(`${name} is invalid`);
  return text;
}

function optionalDate(value: unknown, name: string) {
  const text = optionalString(value, name, 40);
  if (text === undefined) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`${name} must be an ISO date`);
  return date;
}

export function parseAuditFilters(query: Record<string, unknown>): AuditFilters {
  const action = optionalString(query.action, "action", 128);
  if (action !== undefined && !/^[a-z0-9_.]+$/i.test(action)) {
    throw new BadRequestException("action is invalid");
  }
  const targetType = optionalString(query.targetType, "targetType", 64);
  if (targetType !== undefined && !/^[a-z0-9_]+$/i.test(targetType)) {
    throw new BadRequestException("targetType is invalid");
  }
  const filters: AuditFilters = {
    action,
    actorUserId: optionalUuid(query.actorUserId, "actorUserId"),
    projectId: optionalUuid(query.projectId, "projectId"),
    targetType,
    from: optionalDate(query.from, "from"),
    to: optionalDate(query.to, "to"),
  };
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new BadRequestException("from must be before to");
  }
  return filters;
}

export function parseAuditLimit(value: unknown) {
  if (value === undefined || value === "") return AUDIT_PAGE_SIZE;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_AUDIT_PAGE_SIZE) {
    throw new BadRequestException(`limit must be between 1 and ${MAX_AUDIT_PAGE_SIZE}`);
  }
  return limit;
}

export function encodeAuditCursor(cursor: AuditCursor) {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString("base64url");
}

export function decodeAuditCursor(value: unknown): AuditCursor | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || value.length > 200) {
    throw new BadRequestException("cursor is invalid");
  }
  const [createdAt, id] = Buffer.from(value, "base64url").toString().split("|");
  if (!createdAt || !id || !UUID.test(id) || Number.isNaN(new Date(createdAt).getTime())) {
    throw new BadRequestException("cursor is invalid");
  }
  return { createdAt, id };
}

export type AuditExportFormat = "csv" | "json";

export function parseAuditExportFormat(value: unknown): AuditExportFormat {
  if (value === undefined || value === "" || value === "csv") return "csv";
  if (value === "json") return "json";
  throw new BadRequestException("format must be csv or json");
}

/** Spreadsheet apps execute cells starting with these characters as formulas. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : JSON.stringify(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]) {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const EXPORT_HEADER = [
  "createdAt",
  "action",
  "actorEmail",
  "actorName",
  "actorTokenName",
  "ipAddress",
  "userAgent",
  "projectName",
  "targetType",
  "targetId",
  "payload",
];

interface ExportableAuditEntry {
  createdAt: Date;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  actorTokenName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  projectName: string | null;
  targetType: string;
  targetId: string | null;
  payload: unknown;
}

/** Body, content type and file name of an audit export. */
export function renderAuditExport(
  entries: ExportableAuditEntry[],
  format: AuditExportFormat,
  baseName: string,
  now = new Date(),
) {
  const fileName = `${baseName}-audit-${now.toISOString().slice(0, 10)}.${format}`;
  if (format === "json") {
    return { body: JSON.stringify(entries, null, 2), contentType: "application/json", fileName };
  }
  const rows = entries.map((entry) => [
    entry.createdAt.toISOString(),
    entry.action,
    entry.actorEmail,
    entry.actorName,
    entry.actorTokenName,
    entry.ipAddress,
    entry.userAgent,
    entry.projectName,
    entry.targetType,
    entry.targetId,
    entry.payload,
  ]);
  return { body: toCsv(EXPORT_HEADER, rows), contentType: "text/csv; charset=utf-8", fileName };
}
