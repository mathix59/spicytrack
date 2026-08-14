import { BadRequestException } from "@nestjs/common";

import type { AuthenticatedRequest } from "../common/authenticated-request";
import { assertEmail, assertSlug, assertString } from "../common/validators";

function parseCreateOrganizationBody(body: Record<string, unknown>) {
  return {
    name: assertString(body.name, "name"),
    slug: assertSlug(body.slug),
  };
}

function parseCreateInvitationBody(body: Record<string, unknown>) {
  return {
    email: assertEmail(body.email),
    role: assertRole(body.role),
  };
}

function parseAcceptInvitationBody(body: Record<string, unknown>) {
  return {
    token: assertString(body.token, "token"),
  };
}

function parseUpdateMemberRoleBody(body: Record<string, unknown>) {
  return {
    role: assertRole(body.role),
  };
}

function resolveOrganizationActorRole(request: AuthenticatedRequest) {
  return request.organization?.membership.role ?? "viewer";
}

function parseOrganizationJobQueueQuery(input: {
  status?: string;
  type?: string;
  projectId?: string;
  limit?: string;
}): {
  status?: "pending" | "running" | "failed";
  type?: string;
  projectId?: string;
  limit: number;
} {
  return {
    status: normalizeJobStatus(input.status),
    type: normalizeOptionalQuery(input.type),
    projectId: normalizeOptionalQuery(input.projectId),
    limit: normalizePositiveInt(input.limit, 25, "limit", 100),
  };
}

function assertRole(value: unknown): string {
  const role = assertString(value, "role");
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(role)) throw new BadRequestException("Invalid role");
  return role;
}

function normalizeOptionalQuery(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function normalizeJobStatus(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === "pending" || value === "running" || value === "failed") {
    return value;
  }

  throw new BadRequestException("status must be pending, running or failed");
}

export {
  parseAcceptInvitationBody,
  parseCreateInvitationBody,
  parseCreateOrganizationBody,
  parseOrganizationJobQueueQuery,
  parseUpdateMemberRoleBody,
  resolveOrganizationActorRole,
};
