import { BadRequestException } from "@nestjs/common";

/** Keyset position in a list ordered by creation time, newest first, then by id. */
export interface CreatedAtCursor {
  /** ISO timestamp with microseconds, as Postgres stores it. */
  createdAt: string;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCreatedAtCursor(cursor: CreatedAtCursor) {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`).toString("base64url");
}

export function decodeCreatedAtCursor(value: unknown): CreatedAtCursor | undefined {
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

/** A page size from the query string, or the default when it is missing. */
export function parsePageLimit(value: unknown, defaultLimit: number, maxLimit: number) {
  if (value === undefined || value === "") return defaultLimit;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new BadRequestException(`limit must be between 1 and ${maxLimit}`);
  }
  return limit;
}
