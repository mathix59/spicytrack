type IngestProjectAccess = {
  id: string;
  organizationId: string;
  projectKeyId: string;
  keyRateLimitPerMinute: number | null;
  inboundRules: unknown;
  ownershipRules: unknown;
  piiScrubFields: unknown;
};

type IngestContext = {
  projectId: string;
  organizationId: string;
  timestamp: Date;
  environmentId: string | null;
  releaseId: string | null;
  suggestedAssigneeId: string | null;
};

type ParsedEventPayload = {
  sanitizedPayload: Record<string, unknown>;
  groupingKey: string;
  title: string;
  level: string;
  message: string | null;
  normalizedMessage: string | null;
  eventExternalId: string;
  timestamp: Date;
  environmentName: string | null;
  releaseVersion: string | null;
  culprit: string | null;
  platform: string;
  logger: string | null;
  transactionName: string | null;
  serverName: string | null;
  sdkName: string | null;
  sdkVersion: string | null;
  dist: string | null;
  userIdentifier: string | null;
  requestMethod: string | null;
  requestUrl: string | null;
  fingerprintOverride: unknown[] | null;
  tags: Record<string, unknown>;
  contexts: Record<string, unknown>;
  extra: Record<string, unknown>;
};

type ResolveEnvironmentInput = {
  organizationId: string;
  projectId: string;
  environmentName: string | null;
};

type ResolveReleaseInput = {
  organizationId: string;
  projectId: string;
  releaseVersion: string | null;
  timestamp: Date;
};

export type {
  IngestContext,
  IngestProjectAccess,
  ParsedEventPayload,
  ResolveEnvironmentInput,
  ResolveReleaseInput,
};
