import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { GROUPING_VERSION } from "../common/grouping";
import { isUniqueViolation } from "../common/postgres-errors";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  alertRules,
  events,
  ingestRateCounters,
  issues,
  projectKeys,
  projects,
  releases,
} from "../database/schema";

import { ReleaseHealthIngestService } from "../release-health/release-health-ingest.service";
import {
  normalizeSessionAggregates,
  normalizeSessionUpdate,
} from "../release-health/session-updates";
import { IngestResolversService } from "./ingest-resolvers.service";
import { IssueCountsService } from "./issue-counts.service";
import {
  applyProjectPolicies,
  resolveIssueReopenState,
  resolveSuggestedAssignee,
} from "./ingest-policies";
import type { IngestContext, IngestProjectAccess } from "./ingest.types";
import { ingestLimits, LAST_SEEN_RESOLUTION_MS } from "./ingest-limits";
import { recordIngestOutcome } from "./ingest-metrics";
import {
  InvalidEnvelopeError,
  type ParsedEnvelope,
  parseEnvelope,
  parseEventPayload,
} from "./ingest.utils";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

const SENTRY_QUOTA_SCOPES: Record<string, string> = {
  project_key_minute: "key",
  project_hour: "project",
  organization_hour: "organization",
};

export class IngestQuotaExceededException extends HttpException {
  constructor(
    scope: string,
    /** Seconds until the quota window resets. */
    readonly retryAfterSeconds: number,
  ) {
    super(`Ingestion quota exceeded: ${scope}`, HttpStatus.TOO_MANY_REQUESTS);
    this.sentryScope = SENTRY_QUOTA_SCOPES[scope] ?? "project";
  }

  readonly sentryScope: string;

  /**
   * Headers Sentry SDKs read to pause sending until the window resets: Retry-After, and
   * X-Sentry-Rate-Limits as `<seconds>:<categories, empty = all>:<scope>:<reason>`.
   */
  get headers(): Record<string, string> {
    return {
      "Retry-After": String(this.retryAfterSeconds),
      "X-Sentry-Rate-Limits": `${this.retryAfterSeconds}::${this.sentryScope}:quota_exceeded`,
    };
  }
}

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly ingestResolvers: IngestResolversService,
    private readonly postIngestPublisher: PostIngestPublisherService,
    private readonly releaseHealth: ReleaseHealthIngestService,
    private readonly issueCounts: IssueCountsService,
  ) {}

  async ingestStore(projectId: string, payload: Record<string, unknown>, sentryKey?: string) {
    const project = await this.assertProjectAccess(projectId, sentryKey);
    this.assertPayloadSize(Buffer.byteLength(JSON.stringify(payload)));
    return this.trackResult(await this.persistEvent(project, payload));
  }

  async ingestEnvelope(projectId: string, envelope: string, sentryKey?: string) {
    const project = await this.assertProjectAccess(projectId, sentryKey);
    this.assertPayloadSize(Buffer.byteLength(envelope));
    // Envelopes without an event and malformed ones are not stored, so they never reach the
    // quota check in persistEvent.
    let parsed: ParsedEnvelope;
    try {
      parsed = parseEnvelope(envelope);
    } catch (error) {
      if (!(error instanceof InvalidEnvelopeError)) throw error;
      recordIngestOutcome("rejected", "invalid_payload");
      throw new BadRequestException(error.message);
    }

    // The event goes first: when it is refused (quota), the SDK retries the whole envelope
    // and its sessions must not have been counted yet.
    const result = parsed.event
      ? this.trackResult(await this.persistEvent(project, parsed.event))
      : null;
    const sessions = await this.recordSessions(project, parsed);

    if (result) return result;
    if (parsed.sessions.length > 0 || parsed.sessionAggregates.length > 0) {
      return { accepted: true, sessions };
    }
    recordIngestOutcome("dropped", "unsupported_envelope_item");
    return { accepted: true, dropped: true, reason: "unsupported_envelope_item" };
  }

  /** Counts the envelope's session items for release health; returns how many were kept. */
  private async recordSessions(project: IngestProjectAccess, parsed: ParsedEnvelope) {
    const now = new Date();
    const updates = parsed.sessions.flatMap((item) => normalizeSessionUpdate(item, now) ?? []);
    const aggregates = parsed.sessionAggregates.flatMap((item) =>
      normalizeSessionAggregates(item, now),
    );
    const units = updates.length + aggregates.length;
    const unusable = parsed.sessions.length - updates.length;
    if (unusable > 0) recordIngestOutcome("dropped", "invalid_session");
    if (units === 0) return 0;
    if (!(await this.consumeSessionQuota(project, units))) {
      recordIngestOutcome("dropped", "session_quota_exceeded");
      return 0;
    }

    const releaseIds = new Map<string, string | null>();
    const releaseId = async (releaseVersion: string) => {
      if (!releaseIds.has(releaseVersion)) {
        releaseIds.set(
          releaseVersion,
          await this.ingestResolvers.resolveReleaseId({
            organizationId: project.organizationId,
            projectId: project.id,
            releaseVersion,
            timestamp: now,
          }),
        );
      }
      return releaseIds.get(releaseVersion) ?? null;
    };

    let recorded = 0;
    for (const item of [...updates, ...aggregates]) {
      try {
        const id = await releaseId(item.releaseVersion);
        if (!id) continue;
        const scope = {
          organizationId: project.organizationId,
          projectId: project.id,
          releaseId: id,
        };
        if ("sessionId" in item) await this.releaseHealth.recordSessionUpdate(scope, item);
        else await this.releaseHealth.recordAggregate(scope, item);
        recorded += 1;
      } catch (error) {
        // Release health is secondary: losing a session beats failing the event with it.
        this.logger.warn(
          `Recording a session failed for project ${project.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (recorded > 0) recordIngestOutcome("accepted", "session");
    return recorded;
  }

  /** A per-project hourly budget for session items, separate from the event quotas. */
  private async consumeSessionQuota(project: IngestProjectAccess, units: number) {
    const limit = ingestLimits().projectSessionsPerHour;
    if (limit === 0) return true;
    const windowStartedAt = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
    const [counter] = await this.db
      .insert(ingestRateCounters)
      .values({
        scope: "project_sessions_hour",
        scopeId: project.id,
        windowStartedAt,
        count: units,
      })
      .onConflictDoUpdate({
        target: [
          ingestRateCounters.scope,
          ingestRateCounters.scopeId,
          ingestRateCounters.windowStartedAt,
        ],
        set: { count: sql`${ingestRateCounters.count} + ${units}`, updatedAt: new Date() },
      })
      .returning({ count: ingestRateCounters.count });
    return counter.count <= limit;
  }

  /**
   * Sends an event through the whole pipeline with the project's first active key, as an SDK
   * would. It does not count as the project's first event, so onboarding keeps waiting for
   * the real SDK.
   */
  async ingestTestEvent(projectId: string, payload: Record<string, unknown>) {
    const [key] = await this.db
      .select({ publicId: projects.publicId, publicKey: projectKeys.publicKey })
      .from(projectKeys)
      .innerJoin(projects, eq(projects.id, projectKeys.projectId))
      .where(and(eq(projectKeys.projectId, projectId), eq(projectKeys.isActive, true)))
      .orderBy(projectKeys.createdAt)
      .limit(1);
    if (!key) {
      throw new BadRequestException("Create or enable a client key to send a test event");
    }
    const project = await this.assertProjectAccess(String(key.publicId), key.publicKey);
    return this.trackResult(await this.persistEvent(project, payload, { firstEvent: false }));
  }

  private assertPayloadSize(size: number): void {
    const { maxEventBytes } = ingestLimits();
    if (maxEventBytes > 0 && size > maxEventBytes) {
      recordIngestOutcome("rejected", "payload_too_large");
      throw new PayloadTooLargeException(`Event exceeds the ${maxEventBytes} byte limit`);
    }
  }

  private trackResult<T extends { dropped?: boolean; reason?: string }>(result: T): T {
    recordIngestOutcome(result.dropped ? "dropped" : "accepted", result.reason ?? "stored");
    return result;
  }

  private async consumeQuotas(project: IngestProjectAccess): Promise<void> {
    const limits = ingestLimits();
    const quotas = [
      {
        scope: "project_key_minute",
        scopeId: project.projectKeyId,
        limit: project.keyRateLimitPerMinute ?? 0,
        windowMs: 60_000,
      },
      {
        scope: "project_hour",
        scopeId: project.id,
        limit: limits.projectEventsPerHour,
        windowMs: 3_600_000,
      },
      {
        scope: "organization_hour",
        scopeId: project.organizationId,
        limit: limits.organizationEventsPerHour,
        windowMs: 3_600_000,
      },
    ].filter((quota) => quota.limit > 0);
    if (quotas.length === 0) return;

    try {
      await this.db.transaction(async (tx) => {
        // Every event of a project updates the same counter rows: not waiting for the WAL flush
        // shortens how long they stay locked. A crash can only forget a few counted events.
        await tx.execute(sql`set local synchronous_commit = off`);
        for (const quota of quotas) {
          const now = Date.now();
          const windowStartedAt = new Date(Math.floor(now / quota.windowMs) * quota.windowMs);
          const [counter] = await tx
            .insert(ingestRateCounters)
            .values({
              scope: quota.scope,
              scopeId: quota.scopeId,
              windowStartedAt,
              count: 1,
            })
            .onConflictDoUpdate({
              target: [
                ingestRateCounters.scope,
                ingestRateCounters.scopeId,
                ingestRateCounters.windowStartedAt,
              ],
              set: {
                count: sql`${ingestRateCounters.count} + 1`,
                updatedAt: new Date(),
              },
            })
            .returning({ count: ingestRateCounters.count });
          if (counter.count > quota.limit) {
            const resetsAt = windowStartedAt.getTime() + quota.windowMs;
            throw new IngestQuotaExceededException(
              quota.scope,
              Math.max(1, Math.ceil((resetsAt - now) / 1000)),
            );
          }
        }
      });
    } catch (error) {
      if (error instanceof IngestQuotaExceededException) {
        recordIngestOutcome("rejected", "quota_exceeded");
      }
      throw error;
    }
  }

  private async assertProjectAccess(
    projectId: string,
    sentryKey?: string,
  ): Promise<IngestProjectAccess> {
    if (!sentryKey) {
      throw new BadRequestException("Missing sentry key");
    }

    const publicId = Number(projectId);
    if (!Number.isSafeInteger(publicId) || publicId < 1) {
      throw new NotFoundException("Project key not found");
    }

    const [project] = await this.db
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        projectKeyId: projectKeys.id,
        keyRateLimitPerMinute: projectKeys.rateLimitPerMinute,
        inboundRules: projects.inboundRules,
        ownershipRules: projects.ownershipRules,
        piiScrubFields: projects.piiScrubFields,
        hasActiveAlertRules: sql<boolean>`exists (
          select 1 from ${alertRules}
          where ${alertRules.projectId} = ${projects.id} and ${alertRules.isActive}
        )`,
      })
      .from(projects)
      .innerJoin(
        projectKeys,
        and(eq(projectKeys.projectId, projects.id), eq(projectKeys.publicKey, sentryKey)),
      )
      .where(and(eq(projects.publicId, publicId), eq(projectKeys.isActive, true)))
      .limit(1);

    if (!project) {
      throw new NotFoundException("Project key not found");
    }

    return project;
  }

  private async persistEvent(
    project: IngestProjectAccess,
    payload: Record<string, unknown>,
    options: { firstEvent?: boolean } = {},
  ) {
    const parsedPayload = parseEventPayload(payload);
    const policyResult = applyProjectPolicies(project, parsedPayload);
    if (policyResult.ignored) {
      return {
        accepted: true,
        dropped: true,
        reason: "inbound_rule",
        projectId: project.id,
      };
    }
    const existingEvent = await this.findExistingEvent(project.id, parsedPayload.eventExternalId);

    if (existingEvent) {
      return {
        accepted: true,
        projectId: project.id,
        issueId: existingEvent.issueId,
        eventId: existingEvent.id,
      };
    }

    // Counted only now: events dropped by inbound rules and SDK retries of a stored event do not
    // use up the quota.
    await this.consumeQuotas(project);
    const context = await this.buildIngestContext(project, parsedPayload);

    const result = await this.db.transaction(async (tx) => {
      // Events are partitioned, so no unique index guards event_id: concurrent deliveries of
      // the same event wait for each other here, and the later one finds the stored event.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${project.id}:${parsedPayload.eventExternalId}`}, 0))`,
      );
      const duplicate = await this.findExistingEvent(project.id, parsedPayload.eventExternalId, tx);
      if (duplicate) return { duplicate };

      const { issue, issueWasCreated, issueRegressed, mergedFromIssueId, counted } =
        await this.upsertIssue(tx, context, parsedPayload);
      const event = await this.insertEvent(tx, context, issue.id, parsedPayload, mergedFromIssueId);

      if (counted) {
        await this.linkLastEvent(tx, issue.id, event.id);
      } else {
        await this.issueCounts.add(tx, {
          issueId: issue.id,
          eventId: event.id,
          seenAt: context.timestamp,
          title: parsedPayload.title,
          culprit: parsedPayload.culprit,
          level: parsedPayload.level,
        });
      }
      await this.touchProject(tx, project.id, parsedPayload.timestamp, options.firstEvent ?? true);

      return { issue, issueWasCreated, issueRegressed, event, counted };
    });

    if (result.duplicate) {
      return {
        accepted: true,
        projectId: project.id,
        issueId: result.duplicate.issueId,
        eventId: result.duplicate.id,
      };
    }

    const timesSeen = await this.flushIssueCounts(result.issue.id);
    // The post-ingest job only runs alert rules and, for a new issue, autofix: without either it
    // has nothing to do. Counts a skipped flush left pending are swept by the jobs worker.
    if (project.hasActiveAlertRules || result.issueWasCreated) {
      await this.dispatchPostIngestEffects({
        context,
        issueId: result.issue.id,
        eventId: result.event.id,
        issueTitle: result.issue.title,
        issueStatus: result.issue.status,
        timesSeen: timesSeen ?? result.issue.timesSeen + (result.counted ? 0 : 1),
        issueWasCreated: result.issueWasCreated,
        issueRegressed: result.issueRegressed,
      });
    }

    return {
      accepted: true,
      projectId: project.id,
      issueId: result.issue.id,
      eventId: result.event.id,
    };
  }

  /** Pending counts stay for the next flush, or the jobs worker's sweep, when this one fails. */
  private async flushIssueCounts(issueId: string) {
    try {
      return await this.issueCounts.flush(issueId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not flush the counts of issue ${issueId}: ${message}`);
      return null;
    }
  }

  private async buildIngestContext(
    project: IngestProjectAccess,
    payload: ReturnType<typeof parseEventPayload>,
  ): Promise<IngestContext> {
    const environmentId = await this.ingestResolvers.resolveEnvironmentId({
      organizationId: project.organizationId,
      projectId: project.id,
      environmentName: payload.environmentName,
    });
    const releaseId = await this.ingestResolvers.resolveReleaseId({
      organizationId: project.organizationId,
      projectId: project.id,
      releaseVersion: payload.releaseVersion,
      timestamp: payload.timestamp,
    });

    return {
      projectId: project.id,
      organizationId: project.organizationId,
      timestamp: payload.timestamp,
      environmentId,
      releaseId,
      suggestedAssigneeId: resolveSuggestedAssignee(project.ownershipRules, payload),
    };
  }

  private async findIssueByKey(
    tx: TransactionClient,
    projectId: string,
    groupingKey: string,
  ): Promise<typeof issues.$inferSelect | undefined> {
    const [issue] = await tx
      .select()
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.groupingKey, groupingKey)))
      .limit(1);
    return issue;
  }

  /**
   * Moves an issue grouped before v2 onto the event's v2 key, so it keeps receiving events. Runs
   * in a savepoint: when another event adopted or created the v2 issue first, the unique index
   * rejects the update and the caller uses that issue instead.
   */
  private async adoptLegacyIssue(
    tx: TransactionClient,
    projectId: string,
    keys: { groupingKey: string; legacyGroupingKey: string },
  ) {
    const legacyIssue = await this.findIssueByKey(tx, projectId, keys.legacyGroupingKey);
    if (!legacyIssue || legacyIssue.groupingVersion >= GROUPING_VERSION) return undefined;

    try {
      return await tx.transaction(async (savepoint) => {
        const [adopted] = await savepoint
          .update(issues)
          .set({ groupingKey: keys.groupingKey, groupingVersion: GROUPING_VERSION })
          .where(eq(issues.id, legacyIssue.id))
          .returning();
        return adopted;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.findIssueByKey(tx, projectId, keys.groupingKey);
    }
  }

  private async upsertIssue(
    tx: TransactionClient,
    context: IngestContext,
    payload: ReturnType<typeof parseEventPayload>,
  ) {
    let currentIssue = await this.findIssueByKey(tx, context.projectId, payload.groupingKey);
    if (!currentIssue && payload.legacyGroupingKey) {
      currentIssue = await this.adoptLegacyIssue(tx, context.projectId, {
        groupingKey: payload.groupingKey,
        legacyGroupingKey: payload.legacyGroupingKey,
      });
    }
    if (currentIssue) {
      return this.updateExistingIssue(tx, context, payload, currentIssue);
    }

    const [insertedIssue] = await tx
      .insert(issues)
      .values({
        organizationId: context.organizationId,
        projectId: context.projectId,
        environmentId: context.environmentId,
        releaseId: context.releaseId,
        groupingKey: payload.groupingKey,
        groupingVersion: GROUPING_VERSION,
        title: payload.title,
        culprit: payload.culprit,
        level: payload.level,
        status: "open",
        firstSeenAt: context.timestamp,
        lastSeenAt: context.timestamp,
        timesSeen: 1,
        assignedUserId: context.suggestedAssigneeId,
      })
      .onConflictDoNothing()
      .returning();

    if (insertedIssue) {
      return { issue: insertedIssue, issueWasCreated: true, issueRegressed: false, counted: true };
    }

    // Another event created the issue between the lookup and the insert.
    const concurrentIssue = await this.findIssueByKey(tx, context.projectId, payload.groupingKey);
    if (!concurrentIssue) {
      throw new Error("Issue upsert failed: issue not found after conflict");
    }

    return this.updateExistingIssue(tx, context, payload, concurrentIssue);
  }

  private async updateExistingIssue(
    tx: TransactionClient,
    context: IngestContext,
    payload: ReturnType<typeof parseEventPayload>,
    currentIssue: typeof issues.$inferSelect,
  ): Promise<{
    issue: typeof issues.$inferSelect;
    issueWasCreated: boolean;
    issueRegressed: boolean;
    mergedFromIssueId?: string;
    /** False when the event left its count to `IssueCountsService` instead of updating the issue. */
    counted: boolean;
  }> {
    if (currentIssue.mergedIntoIssueId) {
      const [targetIssue] = await tx
        .update(issues)
        .set({
          lastSeenAt: context.timestamp,
          timesSeen: sql`${issues.timesSeen} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(issues.id, currentIssue.mergedIntoIssueId))
        .returning();
      if (targetIssue) {
        return {
          issue: targetIssue,
          issueWasCreated: false,
          issueRegressed: false,
          mergedFromIssueId: currentIssue.id,
          counted: true,
        };
      }
    }

    const { isRegression, shouldReopen } = resolveIssueReopenState(currentIssue, {
      ...context,
      releaseCreatedAt: await this.releaseCreatedAtForReopen(tx, currentIssue, context.releaseId),
    });

    // Most events change nothing but the counters: leave those to a batched flush, so events
    // of a busy issue do not queue on its row.
    const unchanged =
      !shouldReopen &&
      !isRegression &&
      (currentIssue.environmentId !== null || context.environmentId === null) &&
      (context.releaseId === null || context.releaseId === currentIssue.releaseId) &&
      (currentIssue.assignedUserId !== null || context.suggestedAssigneeId === null);
    if (unchanged) {
      return { issue: currentIssue, issueWasCreated: false, issueRegressed: false, counted: false };
    }

    const [updatedIssue] = await tx
      .update(issues)
      .set({
        lastSeenAt: context.timestamp,
        title: payload.title,
        culprit: payload.culprit,
        level: payload.level,
        environmentId: currentIssue.environmentId ?? context.environmentId,
        releaseId: context.releaseId ?? currentIssue.releaseId,
        timesSeen: sql`${issues.timesSeen} + 1`,
        status: shouldReopen ? "open" : currentIssue.status,
        isRegressed: currentIssue.isRegressed || isRegression,
        resolvedAt: shouldReopen ? null : currentIssue.resolvedAt,
        resolvedByUserId: shouldReopen ? null : currentIssue.resolvedByUserId,
        resolvedInReleaseId: shouldReopen ? null : currentIssue.resolvedInReleaseId,
        ignoredUntil: shouldReopen ? null : currentIssue.ignoredUntil,
        assignedUserId: currentIssue.assignedUserId ?? context.suggestedAssigneeId,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, currentIssue.id))
      .returning();

    return {
      issue: updatedIssue,
      issueWasCreated: false,
      issueRegressed: isRegression,
      counted: true,
    };
  }

  /** Only an issue resolved in the next release needs to know when the event's release appeared. */
  private async releaseCreatedAtForReopen(
    tx: TransactionClient,
    issue: typeof issues.$inferSelect,
    releaseId: string | null,
  ): Promise<Date | null> {
    if (
      issue.status !== "resolved" ||
      !issue.resolvedInReleaseId ||
      !releaseId ||
      releaseId === issue.resolvedInReleaseId
    ) {
      return null;
    }
    const [release] = await tx
      .select({ createdAt: releases.createdAt })
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1);
    return release?.createdAt ?? null;
  }

  private async insertEvent(
    tx: TransactionClient,
    context: IngestContext,
    issueId: string,
    payload: ReturnType<typeof parseEventPayload>,
    mergedFromIssueId?: string,
  ) {
    const [event] = await tx
      .insert(events)
      .values({
        organizationId: context.organizationId,
        projectId: context.projectId,
        issueId,
        mergedFromIssueId: mergedFromIssueId ?? null,
        environmentId: context.environmentId,
        releaseId: context.releaseId,
        eventId: payload.eventExternalId,
        platform: payload.platform,
        level: payload.level,
        logger: payload.logger,
        transactionName: payload.transactionName,
        serverName: payload.serverName,
        message: payload.message,
        normalizedMessage: payload.normalizedMessage,
        timestamp: context.timestamp,
        sdkName: payload.sdkName,
        sdkVersion: payload.sdkVersion,
        dist: payload.dist,
        userIdentifier: payload.userIdentifier,
        requestMethod: payload.requestMethod,
        requestUrl: payload.requestUrl,
        fingerprintOverride: payload.fingerprintOverride,
        tags: payload.tags,
        contexts: payload.contexts,
        extra: payload.extra,
        rawPayload: payload.sanitizedPayload,
      })
      .returning();

    return event;
  }

  private async linkLastEvent(tx: TransactionClient, issueId: string, eventId: string) {
    await tx
      .update(issues)
      .set({
        lastEventId: eventId,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId));
  }

  private async touchProject(
    tx: TransactionClient,
    projectId: string,
    timestamp: Date,
    firstEvent: boolean,
  ) {
    await tx
      .update(projects)
      .set({
        ...(firstEvent
          ? { firstEventAt: sql`COALESCE(${projects.firstEventAt}, ${timestamp})` }
          : {}),
        lastEventAt: timestamp,
        updatedAt: new Date(),
      })
      // Every event of the project would otherwise queue on this row: within
      // LAST_SEEN_RESOLUTION_MS the timestamp is close enough.
      .where(
        and(
          eq(projects.id, projectId),
          or(
            isNull(projects.lastEventAt),
            lt(projects.lastEventAt, new Date(timestamp.getTime() - LAST_SEEN_RESOLUTION_MS)),
            firstEvent ? isNull(projects.firstEventAt) : undefined,
          ),
        ),
      );
  }

  private async dispatchPostIngestEffects(input: {
    context: IngestContext;
    issueId: string;
    eventId: string;
    issueTitle: string;
    issueStatus: string;
    timesSeen: number;
    issueWasCreated: boolean;
    issueRegressed: boolean;
  }) {
    await this.postIngestPublisher.enqueue({
      organizationId: input.context.organizationId,
      projectId: input.context.projectId,
      issueId: input.issueId,
      eventId: input.eventId,
      issueTitle: input.issueTitle,
      issueStatus: input.issueStatus,
      timesSeen: input.timesSeen,
      issueWasCreated: input.issueWasCreated,
      issueRegressed: input.issueRegressed,
    });
  }

  private async findExistingEvent(
    projectId: string,
    eventExternalId: string,
    db: DatabaseClient | TransactionClient = this.db,
  ) {
    const [event] = await db
      .select({ id: events.id, issueId: events.issueId })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.eventId, eventExternalId)))
      .limit(1);

    return event;
  }
}
