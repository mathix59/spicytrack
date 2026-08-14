import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class HealthDto {
  @ApiProperty()
  status!: string;

  @ApiProperty()
  service!: string;

  @ApiProperty()
  timestamp!: string;

  @ApiPropertyOptional({ type: "object", additionalProperties: { type: "string" } })
  dependencies?: Record<string, string>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
  })
  jobs?: {
    pending: number;
    running: number;
    failed: number;
    due: number;
  };
}

export class SessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  token!: string;

  @ApiProperty()
  expiresAt!: string;
}

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  emailVerifiedAt?: string | null;

  @ApiProperty()
  twoFactorEnabled!: boolean;
}

export class OrganizationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  ownerUserId!: string;
}

export class OrganizationListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  role!: string;

  @ApiPropertyOptional({ type: [String] })
  permissions?: string[];
}

export class OrganizationRoleDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  key!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: [String] })
  permissions!: string[];
  @ApiProperty()
  isSystem!: boolean;
}

export class CreateOrganizationRoleBodyDto {
  @ApiProperty()
  key!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class UpdateOrganizationRoleBodyDto {
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class OrganizationMemberDto {
  @ApiProperty()
  memberId!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  joinedAt!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;
}

export class OrganizationInvitationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  expiresAt!: string;
}

export class OrganizationOverviewProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  platform!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  visibility!: string;

  @ApiProperty()
  hasActiveKey!: boolean;

  @ApiProperty()
  environmentCount!: number;

  @ApiProperty()
  releaseCount!: number;

  @ApiProperty()
  openIssueCount!: number;

  @ApiProperty()
  regressedIssueCount!: number;

  @ApiProperty()
  eventCount24h!: number;

  @ApiProperty()
  newIssueCount24h!: number;

  @ApiProperty()
  resolvedIssueCount24h!: number;

  @ApiProperty()
  activeAlertCount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastIssueSeenAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastEventAt?: string | null;
}

export class OrganizationOverviewRegressionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectSlug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  timesSeen!: number;

  @ApiProperty()
  lastSeenAt!: string;
}

export class OrganizationOverviewDto {
  @ApiProperty()
  memberCount!: number;

  @ApiProperty()
  teamCount!: number;

  @ApiProperty()
  projectCount!: number;

  @ApiProperty()
  connectedProjectCount!: number;

  @ApiProperty()
  openIssueCount!: number;

  @ApiProperty()
  regressedIssueCount!: number;

  @ApiProperty()
  eventCount24h!: number;

  @ApiProperty()
  newIssueCount24h!: number;

  @ApiProperty()
  resolvedIssueCount24h!: number;

  @ApiProperty({ type: [OrganizationOverviewRegressionDto] })
  topRegressions!: OrganizationOverviewRegressionDto[];

  @ApiProperty({ type: [OrganizationOverviewProjectDto] })
  projects!: OrganizationOverviewProjectDto[];
}

export class JobQueueSummaryDto {
  @ApiProperty()
  pending!: number;

  @ApiProperty()
  running!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  due!: number;
}

export class OrganizationJobDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  projectId?: string | null;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  dedupeKey?: string | null;

  @ApiProperty({ type: Object })
  payload!: Record<string, unknown>;

  @ApiProperty()
  attempts!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastError?: string | null;

  @ApiProperty()
  runAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  startedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  finishedAt?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class OrganizationJobQueueOverviewDto {
  @ApiProperty({ type: JobQueueSummaryDto })
  summary!: JobQueueSummaryDto;

  @ApiProperty({ type: [OrganizationJobDto] })
  jobs!: OrganizationJobDto[];
}

export class TeamDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;
}

export class TeamRoleDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  key!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: [String] })
  permissions!: string[];
  @ApiProperty()
  isSystem!: boolean;
}

export class CreateTeamRoleBodyDto {
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class UpdateTeamRoleBodyDto {
  @ApiProperty()
  name!: string;
  @ApiProperty({ type: [String] })
  permissions!: string[];
}

export class TeamMemberDto {
  @ApiProperty()
  teamMemberId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  role?: string | null;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string | null;
}

export class TeamMembersResponseDto {
  @ApiProperty({ type: TeamDto })
  team!: TeamDto;

  @ApiProperty({ type: [TeamMemberDto] })
  members!: TeamMemberDto[];
}

export class ProjectDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  publicId!: number;

  @ApiProperty()
  organizationId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  teamId?: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  platform!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  visibility!: string;

  @ApiProperty()
  retentionDays!: number;

  @ApiProperty({ type: "array", items: { type: "object", additionalProperties: true } })
  inboundRules!: Array<Record<string, unknown>>;

  @ApiProperty({ type: "array", items: { type: "object", additionalProperties: true } })
  ownershipRules!: Array<Record<string, unknown>>;

  @ApiProperty({ type: [String] })
  piiScrubFields!: string[];

  @ApiProperty({ type: [String] })
  browserAllowedOrigins!: string[];
}

export class ProjectSavedSearchFiltersDto {
  @ApiPropertyOptional({ type: String })
  q?: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  level!: string;

  @ApiProperty()
  assignedUserId!: string;

  @ApiProperty()
  environment!: string;

  @ApiProperty()
  release!: string;

  @ApiProperty()
  isRegressed!: string;

  @ApiProperty()
  sortBy!: string;

  @ApiProperty()
  sortDir!: string;

  @ApiProperty()
  pageSize!: number;
}

export class ProjectSavedSearchDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: ProjectSavedSearchFiltersDto })
  filters!: ProjectSavedSearchFiltersDto;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ProjectKeyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  publicKey!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true })
  rateLimitPerMinute?: number | null;

  @ApiPropertyOptional()
  dsn?: string;

  @ApiPropertyOptional()
  envelopeUrl?: string;
}

export class ProjectEnvironmentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  eventCount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastSeenAt?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class ProjectReleaseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  eventCount!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  firstSeenAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastSeenAt?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AlertRuleDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  triggerType!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  threshold?: number | null;

  @ApiProperty()
  cooldownMinutes!: number;

  @ApiProperty()
  destinationType!: string;

  @ApiProperty()
  destinationTarget!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastTriggeredAt?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AlertDeliveryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  alertRuleId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  issueId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  eventId?: string | null;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  responseStatus?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  responseBody?: string | null;

  @ApiProperty({ type: "object", additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}

export class UpdateProjectBodyDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  platform?: string;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  visibility?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  teamId?: string | null;

  @ApiPropertyOptional()
  retentionDays?: number;

  @ApiPropertyOptional({ type: "array", items: { type: "object", additionalProperties: true } })
  inboundRules?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ type: "array", items: { type: "object", additionalProperties: true } })
  ownershipRules?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ type: [String] })
  piiScrubFields?: string[];

  @ApiPropertyOptional({ type: [String] })
  browserAllowedOrigins?: string[];
}

export class UpdateProjectKeyBodyDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ type: Boolean })
  isActive?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true })
  rateLimitPerMinute?: number | null;
}

export class CreateAlertRuleBodyDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  triggerType!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  threshold?: number | null;

  @ApiPropertyOptional({ type: Number })
  cooldownMinutes?: number;

  @ApiProperty()
  destinationType!: string;

  @ApiProperty()
  destinationTarget!: string;
}

export class UpdateAlertRuleBodyDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ type: Boolean })
  isActive?: boolean;

  @ApiPropertyOptional()
  triggerType?: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  threshold?: number | null;

  @ApiPropertyOptional({ type: Number })
  cooldownMinutes?: number;

  @ApiPropertyOptional()
  destinationType?: string;

  @ApiPropertyOptional()
  destinationTarget?: string;
}

export class IssueStatusUpdateBodyDto {
  @ApiProperty()
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  ignoredUntil?: string | null;
}

export class IssuePriorityUpdateBodyDto {
  @ApiProperty({ enum: ["low", "medium", "high", "critical"] })
  priority!: string;
}

export class IssueAssigneeUpdateBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  assignedUserId?: string | null;
}

export class IssueExternalLinkBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  externalIssueUrl?: string | null;
}

export class MergeIssueBodyDto {
  @ApiProperty()
  targetIssueId!: string;
}

export class CreateIssueCommentBodyDto {
  @ApiProperty()
  body!: string;
}

export class BulkIssueStatusUpdateBodyDto {
  @ApiProperty({ type: [String] })
  issueIds!: string[];

  @ApiProperty()
  status!: string;
}

export class BulkIssuePriorityUpdateBodyDto {
  @ApiProperty({ type: [String] })
  issueIds!: string[];

  @ApiProperty({ enum: ["low", "medium", "high", "critical"] })
  priority!: string;
}

export class BulkIssueAssigneeUpdateBodyDto {
  @ApiProperty({ type: [String] })
  issueIds!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedUserId?: string | null;
}

export class BulkOperationResultDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  updatedCount!: number;
}

export class IssueDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  groupingKey!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  culprit?: string | null;

  @ApiProperty()
  level!: string;

  @ApiProperty({ enum: ["low", "medium", "high", "critical"] })
  priority!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  isRegressed!: boolean;

  @ApiProperty()
  firstSeenAt!: string;

  @ApiProperty()
  lastSeenAt!: string;

  @ApiProperty()
  timesSeen!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedUserId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  externalIssueUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  mergedIntoIssueId?: string | null;
}

export class ProjectReleaseDetailDto {
  @ApiProperty({ type: ProjectReleaseDto })
  release!: ProjectReleaseDto;

  @ApiProperty({ type: [IssueDto] })
  issues!: IssueDto[];
}

export class ReleaseArtifactDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  releaseId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  contentType?: string | null;

  @ApiProperty()
  size!: number;

  @ApiProperty()
  checksum!: string;

  @ApiProperty()
  createdAt!: string;
}

export class IssueCommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  issueId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class IssueActivityDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  issueId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  actorUserId?: string | null;

  @ApiProperty()
  type!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}

export class AuditLogDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  projectId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  actorUserId?: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  targetType!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  targetId?: string | null;

  @ApiProperty({ type: "object", additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;
}

export class PaginatedIssuesDto {
  @ApiProperty({ type: [IssueDto] })
  items!: IssueDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class ResolvedFrameDto {
  @ApiProperty()
  filename!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  function?: string | null;

  @ApiProperty()
  lineno!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  colno?: number | null;

  @ApiProperty()
  resolved!: boolean;

  @ApiProperty({ enum: ["sourcemap", "proguard", "dart_obfuscation", "original"] })
  resolution!: string;

  @ApiProperty()
  diagnostic!: string;
}

export class EventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  issueId!: string;

  @ApiProperty()
  eventId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  environmentId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  environmentName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  releaseId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  releaseVersion?: string | null;

  @ApiProperty()
  platform!: string;

  @ApiProperty()
  level!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  message?: string | null;

  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  rawPayload!: Record<string, unknown>;

  @ApiPropertyOptional({ type: [ResolvedFrameDto] })
  resolvedFrames?: ResolvedFrameDto[];
}

export class PaginatedEventsDto {
  @ApiProperty({ type: [EventDto] })
  items!: EventDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class IssueDetailDto {
  @ApiProperty({ type: IssueDto })
  issue!: IssueDto;

  @ApiProperty({ type: PaginatedEventsDto })
  events!: PaginatedEventsDto;
}

export class IssueTriageDto {
  @ApiProperty({ description: "Evidence-based AI triage briefing in Markdown." })
  briefing!: string;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  evidence!: Record<string, unknown>;
}

export class InvitationResultDto {
  @ApiProperty({ type: "object", additionalProperties: true })
  invitation!: Record<string, unknown>;

  @ApiProperty()
  token!: string;
}

export class MeResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ type: [OrganizationListItemDto] })
  memberships!: OrganizationListItemDto[];
}

export class AuthResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ type: SessionDto })
  session!: SessionDto;
}

export class SuccessDto {
  @ApiProperty()
  success!: boolean;
}

export class IngestAcceptedDto {
  @ApiProperty()
  accepted!: boolean;

  @ApiProperty()
  projectId!: string;

  @ApiProperty()
  issueId!: string;

  @ApiProperty()
  eventId!: string;
}

export class RegisterBodyDto {
  @ApiProperty()
  email!: string;

  @ApiProperty()
  password!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  name?: string;
}

export class LoginBodyDto {
  @ApiProperty()
  email!: string;

  @ApiProperty()
  password!: string;
}

export class RequestPasswordResetBodyDto {
  @ApiProperty()
  email!: string;
}

export class ConfirmPasswordResetBodyDto {
  @ApiProperty()
  token!: string;

  @ApiProperty()
  newPassword!: string;
}

export class ConfirmEmailVerificationBodyDto {
  @ApiProperty()
  token!: string;
}

export class PersonalAccessTokenDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  tokenPreview!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastUsedAt?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class CreatePersonalAccessTokenBodyDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  expiresInDays?: number | null;
}

export class CreatePersonalAccessTokenResponseDto {
  @ApiProperty({ type: PersonalAccessTokenDto })
  token!: PersonalAccessTokenDto;

  @ApiProperty()
  secret!: string;
}

export class CreateOrganizationBodyDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class AcceptInvitationBodyDto {
  @ApiProperty()
  token!: string;
}

export class CreateInvitationBodyDto {
  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;
}

export class UpdateMemberRoleBodyDto {
  @ApiProperty()
  role!: string;
}

export class CreateTeamBodyDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  description?: string;
}

export class UpdateTeamBodyDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description?: string | null;
}

export class AddTeamMemberBodyDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  role?: string;
}

export class CreateProjectBodyDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  platform?: string;

  @ApiPropertyOptional()
  visibility?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  teamId?: string | null;
}

export class CreateProjectKeyBodyDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  rateLimitPerMinute?: number;
}

export class CreateProjectSavedSearchBodyDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ type: ProjectSavedSearchFiltersDto })
  filters!: ProjectSavedSearchFiltersDto;
}

export class SentryEventBodyDto {
  @ApiPropertyOptional()
  event_id?: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  level?: string;

  @ApiPropertyOptional()
  platform?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
  })
  exception?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
  })
  contexts?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
  })
  extra?: Record<string, unknown>;
}

export class RepoConnectionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ["github", "gitlab"] })
  provider!: string;

  @ApiPropertyOptional({ nullable: true })
  baseUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  htmlUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  gitUser?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  gitPort?: number | null;

  @ApiProperty()
  repoIdentifier!: string;

  @ApiProperty()
  defaultBranch!: string;

  @ApiProperty()
  tokenSet!: boolean;

  @ApiPropertyOptional({ nullable: true })
  lastValidatedAt?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class UpsertRepoConnectionBodyDto {
  @ApiProperty({ enum: ["github", "gitlab"] })
  provider!: string;

  @ApiPropertyOptional({ nullable: true })
  baseUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  htmlUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  gitUser?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  gitPort?: number | null;

  @ApiProperty()
  repoIdentifier!: string;

  @ApiPropertyOptional({
    description: "Personal access token. Optional on update to keep the stored one.",
  })
  token?: string;

  @ApiPropertyOptional()
  defaultBranch?: string;
}

export class TestRepoConnectionBodyDto {
  @ApiPropertyOptional({ enum: ["github", "gitlab"] })
  provider?: string;

  @ApiPropertyOptional({ nullable: true })
  baseUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  htmlUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  gitUser?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  gitPort?: number | null;

  @ApiPropertyOptional()
  repoIdentifier?: string;

  @ApiPropertyOptional()
  token?: string;
}

export class TestRepoConnectionResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiPropertyOptional({ nullable: true })
  defaultBranch?: string | null;

  @ApiPropertyOptional({ nullable: true })
  error?: string | null;
}

export class AutofixConfigDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  autoTriggerOnNewIssue!: boolean;

  @ApiProperty()
  autoMerge!: boolean;

  @ApiProperty()
  dailyCap!: number;

  @ApiPropertyOptional({ nullable: true })
  targetBranch?: string | null;
}

export class UpdateAutofixConfigBodyDto {
  @ApiPropertyOptional()
  enabled?: boolean;

  @ApiPropertyOptional()
  autoTriggerOnNewIssue?: boolean;

  @ApiPropertyOptional()
  autoMerge?: boolean;

  @ApiPropertyOptional()
  dailyCap?: number;

  @ApiPropertyOptional({ nullable: true })
  targetBranch?: string | null;
}

export class AutofixRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  issueId!: string;

  @ApiProperty({ enum: ["queued", "running", "succeeded", "failed"] })
  status!: string;

  @ApiProperty({ enum: ["manual", "auto"] })
  trigger!: string;

  @ApiPropertyOptional({ nullable: true })
  branch?: string | null;

  @ApiPropertyOptional({ nullable: true })
  prUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  error?: string | null;

  @ApiPropertyOptional({ nullable: true })
  summary?: string | null;

  @ApiPropertyOptional({ nullable: true })
  inputTokens?: number | null;

  @ApiPropertyOptional({ nullable: true })
  outputTokens?: number | null;

  @ApiPropertyOptional()
  cacheReadTokens?: number | null;

  @ApiPropertyOptional()
  cacheWriteTokens?: number | null;

  @ApiPropertyOptional({
    type: Number,
    description: "Estimated USD cost in micros, when AI_PRICING_JSON is configured.",
  })
  estimatedCostMicros?: number | null;

  @ApiProperty({ enum: ["pending", "approved", "rejected"] })
  reviewStatus!: string;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  reviewComment?: string | null;

  @ApiPropertyOptional({ nullable: true })
  startedAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  finishedAt?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class ReviewAutofixBodyDto {
  @ApiProperty({ enum: ["approved", "rejected"] })
  status!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  comment?: string;
}

export class OrganizationAiSettingsDto {
  @ApiProperty({ enum: ["anthropic", "openai", "google"] })
  provider!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Model id. Null means the provider default.",
  })
  model?: string | null;

  @ApiProperty()
  apiKeySet!: boolean;

  @ApiPropertyOptional({ nullable: true })
  maskedKey?: string | null;
}

export class OrganizationGithubAppSettingsDto {
  @ApiProperty({ enum: ["cloud", "enterprise"] })
  mode!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  htmlUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  gitUser?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  gitPort?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  appSlug?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  appId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  clientId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  installationId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  installationAccountLogin?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  installationAccountType?: string | null;

  @ApiProperty()
  clientSecretSet!: boolean;

  @ApiProperty()
  privateKeySet!: boolean;

  @ApiProperty()
  webhookSecretSet!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  maskedClientSecret?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  maskedWebhookSecret?: string | null;
}

export class UpdateOrganizationAiSettingsBodyDto {
  @ApiPropertyOptional({ enum: ["anthropic", "openai", "google"] })
  provider?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Model id. Pass null to use the provider default.",
  })
  model?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Provider API key. Pass null to clear.",
  })
  apiKey?: string | null;
}

export class UpdateOrganizationGithubAppSettingsBodyDto {
  @ApiPropertyOptional({ enum: ["cloud", "enterprise"] })
  mode?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  htmlUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apiUrl?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  gitUser?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  gitPort?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  appSlug?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  appId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  clientId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  installationId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  installationAccountLogin?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  installationAccountType?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  clientSecret?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  privateKey?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  webhookSecret?: string | null;
}

export class GithubAppInstallUrlDto {
  @ApiProperty()
  url!: string;
}

export class CreateGithubAppManifestBodyDto {
  @ApiPropertyOptional({
    type: String,
    description: "GitHub organization that should own the App. Empty uses the personal account.",
  })
  githubOrganization?: string;
}

export class GithubAppManifestDto {
  @ApiProperty()
  action!: string;

  @ApiProperty()
  state!: string;

  @ApiProperty({ description: "JSON-encoded GitHub App manifest." })
  manifest!: string;
}

export class CompleteGithubAppManifestBodyDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  state!: string;
}

export class GithubAppManifestResultDto {
  @ApiProperty()
  installUrl!: string;

  @ApiProperty({ type: OrganizationGithubAppSettingsDto })
  settings!: OrganizationGithubAppSettingsDto;
}

export class CompleteGithubAppInstallationBodyDto {
  @ApiProperty()
  installationId!: string;

  @ApiPropertyOptional()
  state?: string;
}

export class GithubAppRepositoryDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  defaultBranch!: string;

  @ApiProperty()
  private!: boolean;

  @ApiProperty()
  archived!: boolean;

  @ApiProperty()
  disabled!: boolean;
}
