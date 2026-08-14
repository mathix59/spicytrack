import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  autofixRuns,
  issueActivity,
  organizationAiSettings,
  projectAutofixConfigs,
  issues,
} from "../database/schema";
import { IntegrationsService } from "../integrations/integrations.service";
import { JobsService } from "../jobs/jobs.service";

export type AutofixRunRecord = typeof autofixRuns.$inferSelect;
export type AutofixConfigRecord = typeof projectAutofixConfigs.$inferSelect;

const DEFAULT_CONFIG = {
  enabled: false,
  autoTriggerOnNewIssue: false,
  autoMerge: false,
  dailyCap: 5,
  targetBranch: null as string | null,
};

function maskKey(key: string): string {
  if (key.length <= 8) {
    return "****";
  }

  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

@Injectable()
export class AutofixService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly integrationsService: IntegrationsService,
    private readonly jobsService: JobsService,
    private readonly auditService: AuditService,
  ) {}

  async getConfig(projectId: string) {
    const [config] = await this.db
      .select()
      .from(projectAutofixConfigs)
      .where(eq(projectAutofixConfigs.projectId, projectId))
      .limit(1);

    if (!config) {
      return { ...DEFAULT_CONFIG };
    }

    return {
      enabled: config.enabled,
      autoTriggerOnNewIssue: config.autoTriggerOnNewIssue,
      autoMerge: config.autoMerge,
      dailyCap: config.dailyCap,
      targetBranch: config.targetBranch,
    };
  }

  async updateConfig(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    enabled?: boolean;
    autoTriggerOnNewIssue?: boolean;
    autoMerge?: boolean;
    dailyCap?: number;
    targetBranch?: string | null;
  }) {
    const current = await this.getConfig(input.projectId);
    const next = {
      enabled: input.enabled ?? current.enabled,
      autoTriggerOnNewIssue: input.autoTriggerOnNewIssue ?? current.autoTriggerOnNewIssue,
      autoMerge: input.autoMerge ?? current.autoMerge,
      dailyCap: input.dailyCap ?? current.dailyCap,
      targetBranch: input.targetBranch === undefined ? current.targetBranch : input.targetBranch,
    };

    if (next.dailyCap < 1 || next.dailyCap > 100) {
      throw new BadRequestException("dailyCap must be between 1 and 100");
    }

    if (next.autoMerge && !next.targetBranch) {
      throw new BadRequestException("targetBranch is required when autoMerge is enabled");
    }

    await this.db
      .insert(projectAutofixConfigs)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        ...next,
      })
      .onConflictDoUpdate({
        target: projectAutofixConfigs.projectId,
        set: { ...next, updatedAt: new Date() },
      });

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "autofix.config.updated",
      targetType: "autofix_config",
      payload: next,
    });

    return next;
  }

  async getOrgAiSettings(organizationId: string) {
    const [row] = await this.db
      .select()
      .from(organizationAiSettings)
      .where(eq(organizationAiSettings.organizationId, organizationId))
      .limit(1);

    return {
      provider: row?.provider ?? "anthropic",
      model: row?.model ?? null,
      apiKeySet: Boolean(row?.apiKeyCiphertext),
      maskedKey: row?.apiKeyCiphertext ? maskKey(decryptSecret(row.apiKeyCiphertext)) : null,
    };
  }

  async updateOrgAiSettings(input: {
    organizationId: string;
    actorUserId: string;
    provider?: "anthropic" | "openai" | "google";
    model?: string | null;
    apiKey?: string | null;
  }) {
    const [existing] = await this.db
      .select()
      .from(organizationAiSettings)
      .where(eq(organizationAiSettings.organizationId, input.organizationId))
      .limit(1);

    const providerChanged =
      input.provider !== undefined && input.provider !== (existing?.provider ?? "anthropic");

    const next = {
      provider: input.provider ?? existing?.provider ?? "anthropic",
      model:
        input.model === undefined
          ? providerChanged
            ? null
            : (existing?.model ?? null)
          : input.model,
      // Switching provider invalidates the stored key unless a new one comes in.
      apiKeyCiphertext:
        input.apiKey === undefined
          ? providerChanged
            ? null
            : (existing?.apiKeyCiphertext ?? null)
          : input.apiKey
            ? encryptSecret(input.apiKey)
            : null,
    };

    await this.db
      .insert(organizationAiSettings)
      .values({
        organizationId: input.organizationId,
        ...next,
        updatedByUserId: input.actorUserId,
      })
      .onConflictDoUpdate({
        target: organizationAiSettings.organizationId,
        set: {
          ...next,
          updatedByUserId: input.actorUserId,
          updatedAt: new Date(),
        },
      });

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "org.ai_settings.updated",
      targetType: "organization_ai_settings",
      payload: {
        provider: next.provider,
        model: next.model,
        apiKeySet: Boolean(next.apiKeyCiphertext),
      },
    });

    return this.getOrgAiSettings(input.organizationId);
  }

  async getOrgAiConfig(organizationId: string): Promise<{
    provider: "anthropic" | "openai" | "google";
    model: string | null;
    apiKey: string;
  } | null> {
    const [row] = await this.db
      .select()
      .from(organizationAiSettings)
      .where(eq(organizationAiSettings.organizationId, organizationId))
      .limit(1);

    if (!row?.apiKeyCiphertext) {
      return null;
    }

    return {
      provider: row.provider as "anthropic" | "openai" | "google",
      model: row.model,
      apiKey: decryptSecret(row.apiKeyCiphertext),
    };
  }

  async trigger(input: {
    organizationId: string;
    projectId: string;
    issueId: string;
    actorUserId?: string | null;
    trigger: "manual" | "auto";
  }): Promise<AutofixRunRecord> {
    const [issue] = await this.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, input.issueId), eq(issues.projectId, input.projectId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");

    const connection = await this.integrationsService.findConnection(input.projectId);

    if (!connection) {
      throw new BadRequestException(
        "No repository connected to this project. Connect one in the Integrations settings first.",
      );
    }

    const aiConfig = await this.getOrgAiConfig(input.organizationId);

    if (!aiConfig) {
      throw new BadRequestException(
        "No AI provider API key configured for this organization. Add one in the organization settings.",
      );
    }

    const [inFlight] = await this.db
      .select({ id: autofixRuns.id })
      .from(autofixRuns)
      .where(
        and(
          eq(autofixRuns.issueId, input.issueId),
          inArray(autofixRuns.status, ["queued", "running"]),
        ),
      )
      .limit(1);

    if (inFlight) {
      throw new ConflictException("An autofix run is already in progress for this issue.");
    }

    const [run] = await this.db
      .insert(autofixRuns)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        issueId: input.issueId,
        status: "queued",
        trigger: input.trigger,
        triggeredByUserId: input.actorUserId ?? null,
      })
      .returning();

    await this.jobsService.enqueue("autofix", { runId: run.id }, new Date(), {
      organizationId: input.organizationId,
      projectId: input.projectId,
    });

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      action: "autofix.triggered",
      targetType: "autofix_run",
      targetId: run.id,
      payload: { issueId: input.issueId, trigger: input.trigger },
    });

    return run;
  }

  async maybeAutoTrigger(
    organizationId: string,
    projectId: string,
    issueId: string,
  ): Promise<void> {
    const config = await this.getConfig(projectId);

    if (!config.enabled || !config.autoTriggerOnNewIssue) {
      return;
    }

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(autofixRuns)
      .where(
        and(
          eq(autofixRuns.projectId, projectId),
          eq(autofixRuns.trigger, "auto"),
          gte(autofixRuns.createdAt, sql`date_trunc('day', now())`),
        ),
      );

    if (count >= config.dailyCap) {
      return;
    }

    try {
      await this.trigger({
        organizationId,
        projectId,
        issueId,
        trigger: "auto",
      });
    } catch {
      // Missing connection/key or an in-flight run — auto-trigger is best effort.
    }
  }

  async listRunsForIssue(projectId: string, issueId: string) {
    const [issue] = await this.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");

    return this.db
      .select()
      .from(autofixRuns)
      .where(and(eq(autofixRuns.projectId, projectId), eq(autofixRuns.issueId, issueId)))
      .orderBy(desc(autofixRuns.createdAt))
      .limit(20);
  }

  async getRun(projectId: string, runId: string): Promise<AutofixRunRecord> {
    const [run] = await this.db
      .select()
      .from(autofixRuns)
      .where(and(eq(autofixRuns.id, runId), eq(autofixRuns.projectId, projectId)))
      .limit(1);

    if (!run) {
      throw new NotFoundException("Autofix run not found");
    }

    return run;
  }

  async reviewRun(input: {
    organizationId: string;
    projectId: string;
    runId: string;
    actorUserId: string;
    status: "approved" | "rejected";
    comment?: string;
  }) {
    const [run] = await this.db
      .select()
      .from(autofixRuns)
      .where(and(eq(autofixRuns.id, input.runId), eq(autofixRuns.projectId, input.projectId)))
      .limit(1);
    if (!run) throw new NotFoundException("Autofix run not found");
    if (run.status !== "succeeded") {
      throw new ConflictException("Only a completed Autofix run can be reviewed");
    }

    const [reviewed] = await this.db
      .update(autofixRuns)
      .set({
        reviewStatus: input.status,
        reviewedAt: new Date(),
        reviewedByUserId: input.actorUserId,
        reviewComment: input.comment?.trim() || null,
      })
      .where(eq(autofixRuns.id, run.id))
      .returning();
    await this.db.insert(issueActivity).values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      issueId: run.issueId,
      actorUserId: input.actorUserId,
      type: "autofix_reviewed",
      payload: { runId: run.id, status: input.status, comment: input.comment?.trim() || null },
    });
    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: `autofix.${input.status}`,
      targetType: "autofix_run",
      targetId: run.id,
      payload: { issueId: run.issueId, comment: input.comment?.trim() || null },
    });
    return reviewed;
  }
}
