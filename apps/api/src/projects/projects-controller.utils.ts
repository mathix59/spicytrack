import { BadRequestException } from "@nestjs/common";

import { assertString, optionalNullableString, optionalNumber } from "../common/validators";

function parseCreateProjectBody(body: Record<string, unknown>) {
  return {
    name: assertString(body.name, "name"),
    platform: optionalNullableString(body.platform) ?? undefined,
    visibility: optionalNullableString(body.visibility) ?? undefined,
    teamId: optionalNullableString(body.teamId),
  };
}

function parseUpdateProjectBody(body: Record<string, unknown>) {
  return {
    name: optionalNullableString(body.name) ?? undefined,
    platform: optionalNullableString(body.platform) ?? undefined,
    status: optionalNullableString(body.status) ?? undefined,
    visibility: optionalNullableString(body.visibility) ?? undefined,
    teamId: body.teamId === null ? null : (optionalNullableString(body.teamId) ?? undefined),
    retentionDays: optionalNumber(body.retentionDays, "retentionDays") ?? undefined,
    inboundRules: normalizeInboundRules(body.inboundRules),
    ownershipRules: normalizeOwnershipRules(body.ownershipRules),
    piiScrubFields: normalizeStringList(body.piiScrubFields, "piiScrubFields"),
  };
}

function normalizeInboundRules(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) {
    throw new BadRequestException("inboundRules must be an array with at most 100 entries");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BadRequestException(`inboundRules[${index}] must be an object`);
    }
    const rule = entry as Record<string, unknown>;
    const action = assertString(rule.action, `inboundRules[${index}].action`);
    if (action !== "ignore" && action !== "fingerprint") {
      throw new BadRequestException(`inboundRules[${index}].action must be ignore or fingerprint`);
    }
    const pattern = assertString(rule.pattern, `inboundRules[${index}].pattern`);
    const fingerprint = optionalNullableString(rule.fingerprint) ?? undefined;
    if (action === "fingerprint" && !fingerprint) {
      throw new BadRequestException(`inboundRules[${index}].fingerprint is required`);
    }
    return { action, pattern, fingerprint };
  });
}

function normalizeOwnershipRules(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) {
    throw new BadRequestException("ownershipRules must be an array with at most 100 entries");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new BadRequestException(`ownershipRules[${index}] must be an object`);
    }
    const rule = entry as Record<string, unknown>;
    return {
      pattern: assertString(rule.pattern, `ownershipRules[${index}].pattern`),
      assignedUserId: assertString(rule.assignedUserId, `ownershipRules[${index}].assignedUserId`),
    };
  });
}

function normalizeStringList(value: unknown, fieldName: string) {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new BadRequestException(`${fieldName} must be an array of strings`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseCreateSavedSearchBody(body: Record<string, unknown>) {
  return {
    name: assertString(body.name, "name"),
    filters: normalizeSavedSearchFilters(body.filters),
  };
}

function parseCreateProjectKeyBody(body: Record<string, unknown>) {
  return {
    name: assertString(body.name, "name"),
    rateLimitPerMinute: optionalNumber(body.rateLimitPerMinute, "rateLimitPerMinute"),
  };
}

function parseUpdateProjectKeyBody(body: Record<string, unknown>) {
  let rateLimitPerMinute: number | null | undefined;
  if (body.rateLimitPerMinute === null) {
    rateLimitPerMinute = null;
  } else {
    rateLimitPerMinute = optionalNumber(body.rateLimitPerMinute, "rateLimitPerMinute") ?? undefined;
  }

  return {
    name: optionalNullableString(body.name) ?? undefined,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    rateLimitPerMinute,
  };
}

function normalizeSavedSearchFilters(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("filters must be an object");
  }

  const filters = value as Record<string, unknown>;

  return {
    q: optionalNullableString(filters.q) ?? "",
    status: optionalNullableString(filters.status) ?? "all",
    level: optionalNullableString(filters.level) ?? "all",
    assignedUserId: optionalNullableString(filters.assignedUserId) ?? "all",
    environment: optionalNullableString(filters.environment) ?? "all",
    release: optionalNullableString(filters.release) ?? "all",
    isRegressed: optionalNullableString(filters.isRegressed) ?? "all",
    sortBy: optionalNullableString(filters.sortBy) ?? "lastSeenAt",
    sortDir: optionalNullableString(filters.sortDir) ?? "desc",
    pageSize: optionalNumber(filters.pageSize, "filters.pageSize") ?? 25,
  };
}

export {
  parseCreateProjectBody,
  parseCreateProjectKeyBody,
  parseCreateSavedSearchBody,
  parseUpdateProjectBody,
  parseUpdateProjectKeyBody,
};
