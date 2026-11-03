import { BadRequestException } from "@nestjs/common";

import { assertOneOf, assertString, optionalNumber } from "../common/validators";
import {
  DEFAULT_TOKEN_EXPIRY_DAYS,
  MAX_TOKEN_EXPIRY_DAYS,
  TOKEN_SCOPES,
  type TokenScope,
} from "./token-scopes";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseCreateTokenBody(body: Record<string, unknown>) {
  const name = assertString(body.name, "name");

  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    throw new BadRequestException(`scopes must list at least one of ${TOKEN_SCOPES.join(", ")}`);
  }
  const scopes = [
    ...new Set(body.scopes.map((scope) => assertOneOf(scope, TOKEN_SCOPES, "scopes"))),
  ] as TokenScope[];

  let organizationId: string | null = null;
  if (body.organizationId !== undefined && body.organizationId !== null) {
    organizationId = assertString(body.organizationId, "organizationId");
    if (!UUID_REGEX.test(organizationId)) {
      throw new BadRequestException("organizationId must be an organization ID");
    }
  }

  const expiresInDays =
    optionalNumber(body.expiresInDays ?? undefined, "expiresInDays") ?? DEFAULT_TOKEN_EXPIRY_DAYS;
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > MAX_TOKEN_EXPIRY_DAYS
  ) {
    throw new BadRequestException(
      `expiresInDays must be an integer between 1 and ${MAX_TOKEN_EXPIRY_DAYS}`,
    );
  }

  return { name, scopes, organizationId, expiresInDays };
}
