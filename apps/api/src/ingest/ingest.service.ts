import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { events, ingestRateCounters, issues, projectKeys, projects } from "../database/schema";

import { IngestResolversService } from "./ingest-resolvers.service";
import {
  applyProjectPolicies,
  resolveIssueReopenState,
  resolveSuggestedAssignee,
} from "./ingest-policies";
import type { IngestContext, IngestProjectAccess } from "./ingest.types";
import { ingestLimits } from "./ingest-limits";
import { recordIngestOutcome } from "./ingest-metrics";
import { parseEnvelopeEvent, parseEventPayload } from "./ingest.utils";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";

type TransactionClient = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0];

class IngestQuotaExceededException extends HttpException {
  constructor(scope: string) {
    super(`Ingestion quota exceeded: ${scope}`, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class IngestService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly ingestResolvers: IngestResolversService,
    private readonly postIngestPublisher: PostIngestPublisherService,
  ) {}

  async ingestStore(projectId: string, payload: Record<string, unknown>, sentryKey?: string) {
    const project = await this.assertProjectAccess(projectId, sentryKey);
    this.assertPayloadSize(Buffer.byteLength(JSON.stringify(payload)));
    await this.consumeQuotas(project);
    return this.trackResult(await this.persistEvent(project, payload));
  }

  async ingestEnvelope(projectId: string, envelope: string, sentryKey?: string) {
    const project = await this.assertProjectAccess(projectId, sentryKey);
    this.assertPayloadSize(Buffer.byteLength(envelope));
    await this.consumeQuotas(project);
    const payload = parseEnvelopeEvent(envelope);

    if (!payload) {
      recordIngestOutcome("dropped", "unsupported_envelope_item");
      return { accepted: true, dropped: true, reason: "unsupported_envelope_item" };
    }

    return this.trackResult(await this.persistEvent(project, payload));
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
        for (const quota of quotas) {
          const windowStartedAt = new Date(
            Math.floor(Date.now() / quota.windowMs) * quota.windowMs,
          );
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
            throw new IngestQuotaExceededException(quota.scope);
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

  private async persistEvent(project: IngestProjectAccess, payload: Record<string, unknown>) {
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
    const context = await this.buildIngestContext(project, parsedPayload);

    const existingEvent = await this.findExistingEvent(project.id, parsedPayload.eventExternalId);

    if (existingEvent) {
      return {
        accepted: true,
        projectId: project.id,
        issueId: existingEvent.issueId,
        eventId: existingEvent.id,
      };
    }

    try {
      const result = await this.db.transaction(async (tx) => {
        const { issue, issueWasCreated, issueRegressed } = await this.upsertIssue(
          tx,
          context,
          parsedPayload,
        );
        const event = await this.insertEvent(tx, context, issue.id, parsedPayload);

        await this.linkLastEvent(tx, issue.id, event.id);
        await this.touchProject(tx, project.id, parsedPayload.timestamp);

        return { issue, issueWasCreated, issueRegressed, event };
      });

      await this.dispatchPostIngestEffects({
        context,
        issueId: result.issue.id,
        eventId: result.event.id,
        issueTitle: result.issue.title,
        issueStatus: result.issue.status,
        timesSeen: result.issue.timesSeen,
        issueWasCreated: result.issueWasCreated,
        issueRegressed: result.issueRegressed,
      });

      return {
        accepted: true,
        projectId: project.id,
        issueId: result.issue.id,
        eventId: result.event.id,
      };
    } catch (error) {
      if (!this.isDuplicateEventError(error)) {
        throw error;
      }

      const duplicateEvent = await this.findExistingEvent(
        project.id,
        parsedPayload.eventExternalId,
      );

      if (!duplicateEvent) {
        throw error;
      }

      return {
        accepted: true,
        projectId: project.id,
        issueId: duplicateEvent.issueId,
        eventId: duplicateEvent.id,
      };
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

  private async upsertIssue(
    tx: TransactionClient,
    context: IngestContext,
    payload: ReturnType<typeof parseEventPayload>,
  ) {
    const [insertedIssue] = await tx
      .insert(issues)
      .values({
        organizationId: context.organizationId,
        projectId: context.projectId,
        environmentId: context.environmentId,
        releaseId: context.releaseId,
        groupingKey: payload.groupingKey,
        groupingVersion: 1,
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
      return { issue: insertedIssue, issueWasCreated: true, issueRegressed: false };
    }

    const [currentIssue] = await tx
      .select()
      .from(issues)
      .where(
        and(eq(issues.projectId, context.projectId), eq(issues.groupingKey, payload.groupingKey)),
      )
      .limit(1);

    if (!currentIssue) {
      throw new Error("Issue upsert failed: issue not found after conflict");
    }

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
        return { issue: targetIssue, issueWasCreated: false, issueRegressed: false };
      }
    }

    const { isRegression, shouldReopen } = resolveIssueReopenState(currentIssue, context);

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
        ignoredUntil: shouldReopen ? null : currentIssue.ignoredUntil,
        assignedUserId: currentIssue.assignedUserId ?? context.suggestedAssigneeId,
        updatedAt: new Date(),
      })
      .where(eq(issues.id, currentIssue.id))
      .returning();

    return { issue: updatedIssue, issueWasCreated: false, issueRegressed: isRegression };
  }

  private async insertEvent(
    tx: TransactionClient,
    context: IngestContext,
    issueId: string,
    payload: ReturnType<typeof parseEventPayload>,
  ) {
    const [event] = await tx
      .insert(events)
      .values({
        organizationId: context.organizationId,
        projectId: context.projectId,
        issueId,
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

  private async touchProject(tx: TransactionClient, projectId: string, timestamp: Date) {
    await tx
      .update(projects)
      .set({
        firstEventAt: sql`COALESCE(${projects.firstEventAt}, ${timestamp})`,
        lastEventAt: timestamp,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));
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

  private async findExistingEvent(projectId: string, eventExternalId: string) {
    const [event] = await this.db
      .select({ id: events.id, issueId: events.issueId })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.eventId, eventExternalId)))
      .limit(1);

    return event;
  }

  private isDuplicateEventError(error: unknown): boolean {
    let current: unknown = error;
    const visited = new Set<unknown>();
    while (current && typeof current === "object" && !visited.has(current)) {
      visited.add(current);
      if (
        "code" in current &&
        current.code === "23505" &&
        "constraint" in current &&
        current.constraint === "events_project_event_id_idx"
      ) {
        return true;
      }
      current = "cause" in current ? current.cause : undefined;
    }
    return false;
  }
}
