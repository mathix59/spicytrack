import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: varchar("name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    timezone: varchar("timezone", { length: 64 }),
    locale: varchar("locale", { length: 16 }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const instanceSettings = pgTable("instance_settings", {
  id: boolean("id").primaryKey().default(true),
  registrationsEnabled: boolean("registrations_enabled").notNull().default(true),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: boolean("smtp_secure"),
  smtpUser: text("smtp_user"),
  smtpPassCiphertext: text("smtp_pass_ciphertext"),
  smtpFrom: text("smtp_from"),
  updatedByUserId: uuid("updated_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authUsers = pgTable(
  "user",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("auth_users_email_idx").on(table.email),
  }),
);

export const authSessions = pgTable(
  "session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("auth_sessions_token_idx").on(table.token),
  }),
);

export const authAccounts = pgTable("account", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  providerId: varchar("provider_id", { length: 64 }).notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authVerifications = pgTable("verification", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authTwoFactors = pgTable(
  "twoFactor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backupCodes").notNull(),
    userId: uuid("userId").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failedVerificationCount").notNull().default(0),
    lockedUntil: timestamp("lockedUntil", { withTimezone: true }),
  },
  (table) => ({
    secretIdx: index("twoFactor_secret_idx").on(table.secret),
    userIdIdx: index("twoFactor_userId_idx").on(table.userId),
  }),
);

export const personalAccessTokens = pgTable(
  "personal_access_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    tokenPreview: varchar("token_preview", { length: 12 }).notNull(),
    /** read, write and/or admin; tokens created before scopes existed keep full access. */
    scopes: text("scopes").array().notNull().default(["read", "write", "admin"]),
    /** When set, the token only works in this organization. */
    organizationId: uuid("organization_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("personal_access_tokens_hash_idx").on(table.tokenHash),
  }),
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    ownerUserId: uuid("owner_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("organizations_slug_idx").on(table.slug),
  }),
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 32 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    invitedByUserId: uuid("invited_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgUserIdx: uniqueIndex("organization_members_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
  }),
);

export const organizationRoles = pgTable(
  "organization_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    permissions: jsonb("permissions").notNull().default([]),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationKeyIdx: uniqueIndex("organization_roles_key_idx").on(
      table.organizationId,
      table.key,
    ),
  }),
);

export const organizationMcpSettings = pgTable(
  "organization_mcp_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: uniqueIndex("organization_mcp_settings_org_idx").on(table.organizationId),
  }),
);

export const mcpCredentials = pgTable(
  "mcp_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    tokenPreview: varchar("token_preview", { length: 16 }).notNull(),
    scopes: jsonb("scopes").notNull().default([]),
    allProjects: boolean("all_projects").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("mcp_credentials_hash_idx").on(table.tokenHash),
    organizationIdx: index("mcp_credentials_organization_idx").on(table.organizationId),
  }),
);

export const mcpCredentialProjects = pgTable(
  "mcp_credential_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    credentialId: uuid("credential_id").notNull(),
    projectId: uuid("project_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    credentialProjectIdx: uniqueIndex("mcp_credential_projects_credential_project_idx").on(
      table.credentialId,
      table.projectId,
    ),
  }),
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamSlugIdx: uniqueIndex("teams_org_slug_idx").on(table.organizationId, table.slug),
  }),
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    teamId: uuid("team_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamUserIdx: uniqueIndex("team_members_team_user_idx").on(table.teamId, table.userId),
  }),
);

export const teamRoles = pgTable(
  "team_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    teamId: uuid("team_id").notNull(),
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    permissions: jsonb("permissions").notNull().default([]),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    teamRoleKeyIdx: uniqueIndex("team_roles_team_key_idx").on(table.teamId, table.key),
  }),
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicId: integer("public_id").generatedByDefaultAsIdentity(),
    organizationId: uuid("organization_id").notNull(),
    teamId: uuid("team_id"),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    platform: varchar("platform", { length: 64 }).notNull().default("javascript"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    visibility: varchar("visibility", { length: 32 }).notNull().default("private"),
    retentionDays: integer("retention_days").notNull().default(30),
    inboundRules: jsonb("inbound_rules").notNull().default([]),
    ownershipRules: jsonb("ownership_rules").notNull().default([]),
    piiScrubFields: jsonb("pii_scrub_fields").notNull().default([]),
    browserAllowedOrigins: jsonb("browser_allowed_origins").notNull().default([]),
    firstEventAt: timestamp("first_event_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectPublicIdIdx: uniqueIndex("projects_public_id_idx").on(table.publicId),
    projectSlugIdx: uniqueIndex("projects_org_slug_idx").on(table.organizationId, table.slug),
  }),
);

export const projectSavedSearches = pgTable(
  "project_saved_searches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    filters: jsonb("filters").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectSavedSearchProjectIdx: index("project_saved_searches_project_idx").on(
      table.projectId,
      table.userId,
    ),
  }),
);

export const projectKeys = pgTable(
  "project_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    publicKey: varchar("public_key", { length: 64 }).notNull(),
    secretKeyHash: text("secret_key_hash"),
    isActive: boolean("is_active").notNull().default(true),
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    publicKeyIdx: uniqueIndex("project_keys_public_key_idx").on(table.publicKey),
  }),
);

export const ingestRateCounters = pgTable(
  "ingest_rate_counters",
  {
    scope: varchar("scope", { length: 32 }).notNull(),
    scopeId: uuid("scope_id").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    scopeWindowIdx: uniqueIndex("ingest_rate_counters_scope_window_idx").on(
      table.scope,
      table.scopeId,
      table.windowStartedAt,
    ),
    updatedAtIdx: index("ingest_rate_counters_updated_at_idx").on(table.updatedAt),
  }),
);

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    name: varchar("name", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    envIdx: uniqueIndex("environments_project_name_idx").on(table.projectId, table.name),
  }),
);

export const releases = pgTable(
  "releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    version: varchar("version", { length: 255 }).notNull(),
    // The commit the release was built from; a 40-character SHA version counts as one.
    commitSha: varchar("commit_sha", { length: 64 }),
    // null (never fetched) | pending | synced | unavailable | failed
    commitsStatus: varchar("commits_status", { length: 16 }),
    commitsError: text("commits_error"),
    commitsBaseSha: varchar("commits_base_sha", { length: 64 }),
    commitsTruncated: boolean("commits_truncated").notNull().default(false),
    commitsSyncedAt: timestamp("commits_synced_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    releaseIdx: uniqueIndex("releases_project_version_idx").on(table.projectId, table.version),
  }),
);

export type ReleaseCommitFile = {
  path: string;
  status: "added" | "modified" | "removed" | "renamed";
  previousPath?: string;
};

/** Commits between a release and the previous one, read from the connected repository. */
export const releaseCommits = pgTable(
  "release_commits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    // Newest first.
    position: integer("position").notNull(),
    sha: varchar("sha", { length: 64 }).notNull(),
    message: text("message").notNull(),
    authorName: text("author_name"),
    authorEmail: text("author_email"),
    authorLogin: text("author_login"),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    url: text("url"),
    files: jsonb("files").$type<ReleaseCommitFile[]>().notNull().default([]),
    filesTruncated: boolean("files_truncated").notNull().default(false),
  },
  (table) => ({
    releaseShaIdx: uniqueIndex("release_commits_release_sha_idx").on(table.releaseId, table.sha),
  }),
);

export const releaseArtifacts = pgTable(
  "release_artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    releaseId: uuid("release_id").notNull(),
    name: text("name").notNull(),
    contentType: varchar("content_type", { length: 128 }),
    size: integer("size").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    storageKey: text("storage_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    releaseArtifactNameIdx: uniqueIndex("release_artifacts_release_name_idx").on(
      table.releaseId,
      table.name,
    ),
  }),
);

export const alertRules = pgTable("alert_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  projectId: uuid("project_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  triggerTypes: text("trigger_types").array().notNull(),
  threshold: integer("threshold"),
  /** The event threshold counts events of one issue within this many minutes. */
  thresholdWindowMinutes: integer("threshold_window_minutes").notNull().default(60),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(30),
  destinationType: varchar("destination_type", { length: 32 }).notNull().default("webhook"),
  destinationTarget: text("destination_target").notNull(),
  /** Encrypted HMAC key signing webhook deliveries; null for other destinations. */
  signingSecret: text("signing_secret"),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  /** Kept apart from lastTriggeredAt so digests and instant alerts never silence each other. */
  lastDigestAt: timestamp("last_digest_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Cooldown of an alert rule for one issue, so one noisy issue never silences another. */
export const alertIssueCooldowns = pgTable(
  "alert_issue_cooldowns",
  {
    alertRuleId: uuid("alert_rule_id").notNull(),
    issueId: uuid("issue_id").notNull(),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.alertRuleId, table.issueId] }),
  }),
);

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    alertRuleId: uuid("alert_rule_id").notNull(),
    issueId: uuid("issue_id"),
    eventId: uuid("event_id"),
    /** pending → (retrying →)* success | failed. */
    status: varchar("status", { length: 32 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectCreatedIdx: index("alert_deliveries_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    // Retention purges settled deliveries across all projects by age.
    createdIdx: index("alert_deliveries_created_idx").on(table.createdAt),
  }),
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    environmentId: uuid("environment_id"),
    releaseId: uuid("release_id"),
    groupingKey: text("grouping_key").notNull(),
    groupingVersion: integer("grouping_version").notNull().default(1),
    title: text("title").notNull(),
    culprit: text("culprit"),
    level: varchar("level", { length: 32 }).notNull().default("error"),
    priority: varchar("priority", { length: 16 }).notNull().default("medium"),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    isRegressed: boolean("is_regressed").notNull().default(false),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastEventId: uuid("last_event_id"),
    timesSeen: integer("times_seen").notNull().default(1),
    assignedUserId: uuid("assigned_user_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id"),
    /**
     * Resolved "in the next release": the project's latest release when it was resolved. Only an
     * event from a release created after the resolution reopens the issue.
     */
    resolvedInReleaseId: uuid("resolved_in_release_id"),
    ignoredUntil: timestamp("ignored_until", { withTimezone: true }),
    externalIssueUrl: text("external_issue_url"),
    mergedIntoIssueId: uuid("merged_into_issue_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issueGroupingIdx: uniqueIndex("issues_project_grouping_idx").on(
      table.projectId,
      table.groupingVersion,
      table.groupingKey,
    ),
    // Ingestion looks issues up by key whatever their grouping version.
    groupingKeyIdx: index("issues_project_grouping_key_idx").on(table.projectId, table.groupingKey),
    lastSeenIdx: index("issues_project_last_seen_idx").on(table.projectId, table.lastSeenAt),
    statusLastSeenIdx: index("issues_project_status_last_seen_idx").on(
      table.projectId,
      table.status,
      table.lastSeenAt,
    ),
    mergedIntoIdx: index("issues_merged_into_idx")
      .on(table.mergedIntoIssueId)
      .where(sql`${table.mergedIntoIssueId} is not null`),
  }),
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    issueId: uuid("issue_id").notNull(),
    /** Issue this event was grouped into before a merge, so unmerge can give it back. */
    mergedFromIssueId: uuid("merged_from_issue_id"),
    environmentId: uuid("environment_id"),
    releaseId: uuid("release_id"),
    eventId: varchar("event_id", { length: 64 }).notNull(),
    platform: varchar("platform", { length: 64 }).notNull().default("javascript"),
    level: varchar("level", { length: 32 }).notNull().default("error"),
    logger: varchar("logger", { length: 128 }),
    transactionName: text("transaction_name"),
    serverName: text("server_name"),
    message: text("message"),
    normalizedMessage: text("normalized_message"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
    sdkName: varchar("sdk_name", { length: 128 }),
    sdkVersion: varchar("sdk_version", { length: 64 }),
    dist: varchar("dist", { length: 128 }),
    userIdentifier: text("user_identifier"),
    requestMethod: varchar("request_method", { length: 16 }),
    requestUrl: text("request_url"),
    fingerprintOverride: jsonb("fingerprint_override"),
    tags: jsonb("tags").notNull().default({}),
    contexts: jsonb("contexts").notNull().default({}),
    extra: jsonb("extra").notNull().default({}),
    rawPayload: jsonb("raw_payload").notNull(),
  },
  (table) => ({
    eventExternalIdx: uniqueIndex("events_project_event_id_idx").on(table.projectId, table.eventId),
    issueTimestampIdx: index("events_issue_timestamp_idx").on(table.issueId, table.timestamp),
    projectTimestampIdx: index("events_project_timestamp_idx").on(table.projectId, table.timestamp),
    // Issue list filters by environment / release read issue ids straight from these.
    projectEnvironmentIssueIdx: index("events_project_environment_issue_idx").on(
      table.projectId,
      table.environmentId,
      table.issueId,
    ),
    projectReleaseIssueIdx: index("events_project_release_issue_idx").on(
      table.projectId,
      table.releaseId,
      table.issueId,
    ),
    projectIngestedIdx: index("events_project_ingested_idx").on(table.projectId, table.ingestedAt),
    mergedFromIdx: index("events_merged_from_idx")
      .on(table.mergedFromIssueId)
      .where(sql`${table.mergedFromIssueId} is not null`),
    // Issue search by tag (`key:value`, `has:key`).
    tagsIdx: index("events_tags_idx").using("gin", table.tags),
  }),
);

export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    issueId: uuid("issue_id").notNull(),
    userId: uuid("user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issueCreatedIdx: index("issue_comments_issue_created_idx").on(table.issueId, table.createdAt),
  }),
);

export const issueActivity = pgTable(
  "issue_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    issueId: uuid("issue_id").notNull(),
    actorUserId: uuid("actor_user_id"),
    type: varchar("type", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issueCreatedIdx: index("issue_activity_issue_created_idx").on(table.issueId, table.createdAt),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Null for instance-level events (super-admin actions outside any organization). */
    organizationId: uuid("organization_id"),
    projectId: uuid("project_id"),
    actorUserId: uuid("actor_user_id"),
    /** Set when the actor authenticated with a personal access token. */
    actorTokenId: uuid("actor_token_id"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    action: varchar("action", { length: 128 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: uuid("target_id"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationCreatedIdx: index("audit_logs_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    createdIdx: index("audit_logs_created_idx").on(table.createdAt),
    instanceCreatedIdx: index("audit_logs_instance_created_idx")
      .on(table.createdAt)
      .where(sql`${table.organizationId} IS NULL`),
  }),
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 32 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedByUserId: uuid("invited_by_user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    invitationTokenIdx: uniqueIndex("invitations_token_hash_idx").on(table.tokenHash),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id"),
    projectId: uuid("project_id"),
    type: varchar("type", { length: 64 }).notNull(),
    dedupeKey: varchar("dedupe_key", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    payload: jsonb("payload").notNull().default({}),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: index("jobs_organization_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    projectIdx: index("jobs_project_created_idx").on(table.projectId, table.createdAt),
    statusRunAtIdx: index("jobs_status_run_at_idx").on(table.status, table.runAt),
    pendingDedupeIdx: uniqueIndex("jobs_type_dedupe_pending_idx")
      .on(table.type, table.dedupeKey)
      .where(sql`${table.dedupeKey} is not null and ${table.status} in ('pending', 'running')`),
  }),
);

export const repoConnections = pgTable(
  "repo_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    provider: varchar("provider", { length: 16 }).notNull(),
    baseUrl: text("base_url"),
    htmlUrl: text("html_url"),
    apiUrl: text("api_url"),
    gitUser: varchar("git_user", { length: 64 }),
    gitPort: integer("git_port"),
    repoIdentifier: text("repo_identifier").notNull(),
    tokenCiphertext: text("token_ciphertext"),
    defaultBranch: varchar("default_branch", { length: 255 }).notNull().default("main"),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: uniqueIndex("repo_connections_project_idx").on(table.projectId),
  }),
);

export type TicketTrackerConfig =
  | {
      provider: "github";
      /** `owner/repo`. Null uses the project's connected GitHub repository. */
      repository: string | null;
    }
  | { provider: "linear"; teamId: string; teamKey: string; teamName: string }
  | {
      provider: "jira";
      baseUrl: string;
      /** Jira Cloud signs in with email and API token; Data Center with a personal token. */
      email: string | null;
      projectKey: string;
      issueType: string;
    };

/** Where a project's errors become tickets: a GitHub repository, a Linear team or a Jira project. */
export const ticketTrackers = pgTable(
  "ticket_trackers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    provider: varchar("provider", { length: 16 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    config: jsonb("config").$type<TicketTrackerConfig>().notNull(),
    /** Null for GitHub trackers that use the project's repository connection. */
    tokenCiphertext: text("token_ciphertext"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectNameIdx: uniqueIndex("ticket_trackers_project_name_idx").on(table.projectId, table.name),
  }),
);

/** Tickets created from an issue. The tracker may be deleted later; the link stays. */
export const issueTickets = pgTable(
  "issue_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    trackerId: uuid("tracker_id").references(() => ticketTrackers.id, { onDelete: "set null" }),
    provider: varchar("provider", { length: 16 }).notNull(),
    /** Human key shown in the UI: `#12`, `ENG-34`, `OPS-5`. */
    externalKey: varchar("external_key", { length: 128 }).notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issueIdx: index("issue_tickets_issue_idx").on(table.issueId),
  }),
);

export const organizationGithubAppRepositories = pgTable(
  "organization_github_app_repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    installationId: varchar("installation_id", { length: 64 }).notNull(),
    githubRepositoryId: bigint("github_repository_id", { mode: "number" }).notNull(),
    fullName: text("full_name").notNull(),
    defaultBranch: varchar("default_branch", { length: 255 }).notNull(),
    private: boolean("private").notNull().default(true),
    archived: boolean("archived").notNull().default(false),
    disabled: boolean("disabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationRepoIdx: uniqueIndex("org_github_app_repos_org_repo_idx").on(
      table.organizationId,
      table.githubRepositoryId,
    ),
    organizationInstallationIdx: index("org_github_app_repos_installation_idx").on(
      table.organizationId,
      table.installationId,
    ),
  }),
);

export const organizationAiSettings = pgTable(
  "organization_ai_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    provider: varchar("provider", { length: 16 }).notNull().default("anthropic"),
    model: varchar("model", { length: 128 }),
    // Column name predates multi-provider support; it stores the key of
    // whichever provider is selected.
    apiKeyCiphertext: text("anthropic_api_key_ciphertext"),
    // USD micros. Null means no limit.
    monthlyBudgetMicros: bigint("monthly_budget_micros", { mode: "number" }),
    runCostCapMicros: bigint("run_cost_cap_micros", { mode: "number" }),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: uniqueIndex("organization_ai_settings_org_idx").on(table.organizationId),
  }),
);

export const projectAutofixConfigs = pgTable(
  "project_autofix_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    autoTriggerOnNewIssue: boolean("auto_trigger_on_new_issue").notNull().default(false),
    autoMerge: boolean("auto_merge").notNull().default(false),
    autoFixAfterAnalysis: boolean("auto_fix_after_analysis").notNull().default(false),
    requirePassingChecks: boolean("require_passing_checks").notNull().default(true),
    dailyCap: integer("daily_cap").notNull().default(5),
    targetBranch: varchar("target_branch", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdx: uniqueIndex("project_autofix_configs_project_idx").on(table.projectId),
  }),
);

export const organizationGithubAppSettings = pgTable(
  "organization_github_app_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    mode: varchar("mode", { length: 16 }).notNull().default("cloud"),
    htmlUrl: text("html_url"),
    apiUrl: text("api_url"),
    gitUser: varchar("git_user", { length: 64 }),
    gitPort: integer("git_port"),
    appSlug: varchar("app_slug", { length: 128 }),
    appId: varchar("app_id", { length: 64 }),
    clientId: varchar("client_id", { length: 128 }),
    installationId: varchar("installation_id", { length: 64 }),
    installationAccountLogin: varchar("installation_account_login", { length: 255 }),
    installationAccountType: varchar("installation_account_type", { length: 32 }),
    clientSecretCiphertext: text("client_secret_ciphertext"),
    privateKeyCiphertext: text("private_key_ciphertext"),
    webhookSecretCiphertext: text("webhook_secret_ciphertext"),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: uniqueIndex("org_github_app_settings_org_idx").on(table.organizationId),
  }),
);

/** The organization's own Slack app: buttons in Slack alerts act on issues through it. */
export const organizationSlackSettings = pgTable(
  "organization_slack_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    /** Slack workspace id (T…), read from the bot token. Interactions are matched on it. */
    teamId: varchar("team_id", { length: 32 }).notNull(),
    teamName: varchar("team_name", { length: 255 }),
    signingSecretCiphertext: text("signing_secret_ciphertext").notNull(),
    botTokenCiphertext: text("bot_token_ciphertext").notNull(),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdx: uniqueIndex("org_slack_settings_org_idx").on(table.organizationId),
    teamIdx: index("org_slack_settings_team_idx").on(table.teamId),
  }),
);

export const autofixRuns = pgTable(
  "autofix_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    issueId: uuid("issue_id").notNull(),
    // analysis: find the root cause, read-only. fix: write, push, wait for CI, open the PR.
    phase: varchar("phase", { length: 16 }).notNull().default("fix"),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    trigger: varchar("trigger", { length: 16 }).notNull(),
    triggeredByUserId: uuid("triggered_by_user_id"),
    fixRequestedByUserId: uuid("fix_requested_by_user_id"),
    analysis: jsonb("analysis"),
    branch: text("branch"),
    commitSha: varchar("commit_sha", { length: 64 }),
    checksStatus: varchar("checks_status", { length: 16 }),
    checksSummary: jsonb("checks_summary"),
    checksStartedAt: timestamp("checks_started_at", { withTimezone: true }),
    checksDeadlineAt: timestamp("checks_deadline_at", { withTimezone: true }),
    prUrl: text("pr_url"),
    error: text("error"),
    summary: text("summary"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    estimatedCostMicros: integer("estimated_cost_micros"),
    reviewStatus: varchar("review_status", { length: 16 }).notNull().default("pending"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id"),
    reviewComment: text("review_comment"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issueIdx: index("autofix_runs_issue_idx").on(table.issueId, table.createdAt),
    // At most one run per issue in flight (queued, running or waiting for CI), even when two
    // triggers race.
    inFlightIssueIdx: uniqueIndex("autofix_runs_in_flight_issue_idx")
      .on(table.issueId)
      .where(sql`${table.status} in ('queued', 'running', 'checking')`),
    projectCreatedIdx: index("autofix_runs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  }),
);

export const issueTriageRuns = pgTable(
  "issue_triage_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    issueId: uuid("issue_id").notNull(),
    generatedByUserId: uuid("generated_by_user_id"),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 255 }),
    status: varchar("status", { length: 16 }).notNull().default("succeeded"),
    briefing: text("briefing"),
    evidence: jsonb("evidence").notNull().default({}),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheWriteTokens: integer("cache_write_tokens"),
    estimatedCostMicros: integer("estimated_cost_micros"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issueCreatedIdx: index("issue_triage_runs_issue_created_idx").on(
      table.issueId,
      table.createdAt,
    ),
    organizationCreatedIdx: index("issue_triage_runs_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  }),
);

export const aiUsageLedger = pgTable(
  "ai_usage_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id"),
    issueId: uuid("issue_id"),
    operation: varchar("operation", { length: 32 }).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 255 }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    usageDimensions: jsonb("usage_dimensions").notNull().default({}),
    pricingRuleId: uuid("pricing_rule_id"),
    pricingSnapshot: jsonb("pricing_snapshot"),
    billingContext: jsonb("billing_context").notNull().default({}),
    estimatedCostMicros: integer("estimated_cost_micros"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationCreatedIdx: index("ai_usage_ledger_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
  }),
);

export const aiPricingCatalogVersions = pgTable(
  "ai_pricing_catalog_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceUrl: text("source_url").notNull(),
    sourceRevision: varchar("source_revision", { length: 255 }),
    etag: varchar("etag", { length: 255 }),
    schemaVersion: integer("schema_version").notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sourceRevisionIdx: uniqueIndex("ai_pricing_catalog_source_revision_idx").on(
      table.sourceUrl,
      table.sourceRevision,
    ),
  }),
);

export const aiModelPricingRules = pgTable(
  "ai_model_pricing_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    catalogVersionId: uuid("catalog_version_id").notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("USD"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    ratesPerMillion: jsonb("rates_per_million").notNull(),
    pricingConfig: jsonb("pricing_config").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerModelEffectiveIdx: index("ai_model_pricing_provider_model_effective_idx").on(
      table.provider,
      table.model,
      table.effectiveFrom,
    ),
  }),
);

export const organizationAiPricingOverrides = pgTable(
  "organization_ai_pricing_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    conditions: jsonb("conditions").notNull().default({}),
    ratesPerMillion: jsonb("rates_per_million").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    updatedByUserId: uuid("updated_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationProviderModelIdx: index("org_ai_pricing_override_lookup_idx").on(
      table.organizationId,
      table.provider,
      table.model,
    ),
  }),
);
