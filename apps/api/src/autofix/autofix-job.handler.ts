import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { AiUsageService } from "../ai-usage/ai-usage.service";
import { SourcemapResolverService } from "../artifacts/sourcemap-resolver.service";
import { getAllFrames } from "../common/grouping";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  autofixRuns,
  events,
  issueActivity,
  issues,
  organizations,
  projects,
} from "../database/schema";
import { IntegrationsService } from "../integrations/integrations.service";
import type { VcsProviderKind } from "../integrations/vcs/vcs-provider.interface";
import { VcsFactory } from "../integrations/vcs/vcs.factory";
import type { Job } from "../jobs/jobs.service";
import { resolveModel, runAutofixAgent } from "./agent";
import { AutofixService } from "./autofix.service";
import { commitAll, hasChanges, pushBranch, scrubSecret, shallowClone } from "./git";
import { CodebaseMemoryMcp } from "./mcp-client";
import { buildTaskPrompt } from "./prompt";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable()
export class AutofixJobHandler {
  private readonly logger = new Logger(AutofixJobHandler.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly integrationsService: IntegrationsService,
    private readonly autofixService: AutofixService,
    private readonly vcsFactory: VcsFactory,
    private readonly sourcemapResolverService: SourcemapResolverService,
    private readonly auditService: AuditService,
    private readonly aiUsageService: AiUsageService,
  ) {}

  async run(job: Job): Promise<void> {
    const runId = (job.payload as { runId?: string }).runId;

    if (!runId) {
      throw new Error("autofix job payload is missing runId");
    }

    const [run] = await this.db
      .select()
      .from(autofixRuns)
      .where(eq(autofixRuns.id, runId))
      .limit(1);

    if (!run) {
      throw new Error(`autofix run ${runId} not found`);
    }

    await this.db
      .update(autofixRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(autofixRuns.id, runId));

    let token = "";

    try {
      const timeoutMs = Number(process.env.AUTOFIX_JOB_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

      const result = await this.withTimeout(
        this.execute(run, (usedToken) => {
          token = usedToken;
        }),
        timeoutMs,
      );

      await this.db
        .update(autofixRuns)
        .set({
          status: "succeeded",
          branch: result.branch,
          prUrl: result.prUrl,
          summary: result.summary,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cacheReadTokens: result.cacheReadTokens,
          cacheWriteTokens: result.cacheWriteTokens,
          estimatedCostMicros: result.estimatedCostMicros,
          finishedAt: new Date(),
        })
        .where(eq(autofixRuns.id, runId));

      await this.db.insert(issueActivity).values({
        organizationId: run.organizationId,
        projectId: run.projectId,
        issueId: run.issueId,
        actorUserId: run.triggeredByUserId,
        type: "autofix_completed",
        payload: { runId, prUrl: result.prUrl, branch: result.branch },
      });

      await this.auditService.record({
        organizationId: run.organizationId,
        projectId: run.projectId,
        actorUserId: run.triggeredByUserId,
        action: "autofix.succeeded",
        targetType: "autofix_run",
        targetId: runId,
        payload: { issueId: run.issueId, prUrl: result.prUrl },
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const message = scrubSecret(raw, token).slice(0, 2000);

      this.logger.error(`Autofix run ${runId} failed: ${message}`);

      await this.db
        .update(autofixRuns)
        .set({ status: "failed", error: message, finishedAt: new Date() })
        .where(eq(autofixRuns.id, runId));

      await this.auditService.record({
        organizationId: run.organizationId,
        projectId: run.projectId,
        actorUserId: run.triggeredByUserId,
        action: "autofix.failed",
        targetType: "autofix_run",
        targetId: runId,
        payload: { issueId: run.issueId, error: message },
      });
    }
  }

  private async execute(
    run: typeof autofixRuns.$inferSelect,
    onToken: (token: string) => void,
  ): Promise<{
    branch: string;
    prUrl: string;
    summary: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedCostMicros: number | null;
  }> {
    const [issue] = await this.db.select().from(issues).where(eq(issues.id, run.issueId)).limit(1);

    if (!issue) {
      throw new Error("Issue no longer exists");
    }

    const [event] = issue.lastEventId
      ? await this.db.select().from(events).where(eq(events.id, issue.lastEventId)).limit(1)
      : [];

    if (!event) {
      throw new Error("No event available for this issue");
    }

    const connection = await this.integrationsService.getAutofixConnection(
      run.projectId,
      run.organizationId,
    );

    if (!connection) {
      throw new Error("Repo connection was removed");
    }

    onToken(connection.input.token);

    const aiConfig = await this.autofixService.getOrgAiConfig(run.organizationId);

    if (!aiConfig) {
      throw new Error("Organization AI provider API key was removed");
    }

    const config = await this.autofixService.getConfig(run.projectId);
    const targetBranch = config.targetBranch ?? connection.defaultBranch;
    const provider = this.vcsFactory.getProvider(connection.provider as VcsProviderKind);

    const rawPayload = event.rawPayload as Record<string, unknown>;
    const resolvedFrames = await this.sourcemapResolverService.resolveFrames({
      releaseId: event.releaseId,
      frames: getAllFrames(rawPayload),
      sdkName: event.sdkName,
      platform: event.platform,
    });

    const workRoot = process.env.AUTOFIX_WORKDIR ?? "/tmp/spicytrack-autofix";
    await mkdir(workRoot, { recursive: true });
    const workDir = await mkdtemp(path.join(workRoot, "run-"));
    const repoDir = path.join(workDir, "repo");
    const mcp = new CodebaseMemoryMcp();

    try {
      const authenticatedUrl = provider.getAuthenticatedCloneUrl(connection.input);
      const cleanUrl = scrubSecret(authenticatedUrl, connection.input.token);

      await shallowClone(authenticatedUrl, cleanUrl, targetBranch, repoDir);

      let analysisCapabilityWarning: string | undefined;
      const mcpConnected = await mcp.connect();
      // Codebase-memory is an optional retrieval aid. Its indexer can reject
      // individual files; the agent still has bounded local file tools and
      // should be allowed to continue when that happens.
      if (mcpConnected) {
        try {
          await mcp.callTool("index_repository", { repo_path: repoDir });
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          analysisCapabilityWarning = `Codebase-memory MCP could not index the repository: ${detail.slice(0, 500)}`;
          this.logger.warn(`Autofix run ${run.id}: ${analysisCapabilityWarning}`);
        }
      } else {
        analysisCapabilityWarning =
          "Codebase-memory MCP is unavailable, so graph-based codebase analysis could not be used.";
        this.logger.warn(`Autofix run ${run.id}: ${analysisCapabilityWarning}`);
      }

      const taskPrompt = buildTaskPrompt({
        issue: {
          title: issue.title,
          culprit: issue.culprit,
          level: issue.level,
          timesSeen: issue.timesSeen,
          firstSeenAt: issue.firstSeenAt,
          lastSeenAt: issue.lastSeenAt,
        },
        event: { message: event.message, rawPayload },
        resolvedFrames,
        analysisCapabilityWarning,
      });

      const agentResult = await runAutofixAgent({
        model: resolveModel(aiConfig),
        repoDir,
        mcp,
        taskPrompt,
      });
      const usage = await this.aiUsageService.record({
        organizationId: run.organizationId,
        projectId: run.projectId,
        issueId: run.issueId,
        operation: "autofix",
        provider: aiConfig.provider,
        model: aiConfig.model,
        billingContext: { processingMode: "standard" },
        inputTokens: agentResult.inputTokens,
        outputTokens: agentResult.outputTokens,
        cacheReadTokens: agentResult.cacheReadTokens,
        cacheWriteTokens: agentResult.cacheWriteTokens,
      });

      if (!(await hasChanges(repoDir))) {
        throw new Error(
          `The agent made no code changes. Agent report: ${agentResult.summary.slice(0, 500)}`,
        );
      }

      const branch = `autofix/issue-${run.issueId.slice(0, 8)}-${run.id.slice(0, 8)}`;

      await commitAll(repoDir, `fix: ${issue.title} (SpicyTrack autofix)`);
      await pushBranch(repoDir, authenticatedUrl, branch);

      const summary = analysisCapabilityWarning
        ? `${agentResult.summary}\n\n> Analysis capability warning: ${analysisCapabilityWarning}`
        : agentResult.summary;
      const issueUrl = await this.buildIssueUrl(run);
      const pr = await provider.createPullRequest(connection.input, {
        sourceBranch: branch,
        targetBranch,
        title: `Autofix: ${issue.title}`.slice(0, 250),
        body: `${summary}\n\n---\nGenerated by SpicyTrack Autofix for issue [${issue.title}](${issueUrl}).`,
      });

      let completedSummary = summary;
      if (config.autoMerge) {
        try {
          await provider.mergePullRequest(connection.input, pr.id);
          completedSummary += `\n\nAutomatically squash-merged into ${targetBranch}.`;
          await this.auditService.record({
            organizationId: run.organizationId,
            projectId: run.projectId,
            actorUserId: run.triggeredByUserId,
            action: "autofix.pull_request.auto_merged",
            targetType: "autofix_run",
            targetId: run.id,
            payload: { issueId: run.issueId, prUrl: pr.url, targetBranch },
          });
        } catch (error) {
          const autoMergeError = scrubSecret(
            error instanceof Error ? error.message : String(error),
            connection.input.token,
          ).slice(0, 500);
          this.logger.warn(`Autofix run ${run.id} could not auto-merge: ${autoMergeError}`);
          completedSummary += `\n\nAutomatic merge into ${targetBranch} was requested but the repository refused it. The pull request remains open for review.`;
          await this.auditService.record({
            organizationId: run.organizationId,
            projectId: run.projectId,
            actorUserId: run.triggeredByUserId,
            action: "autofix.pull_request.auto_merge_failed",
            targetType: "autofix_run",
            targetId: run.id,
            payload: { issueId: run.issueId, prUrl: pr.url, targetBranch, error: autoMergeError },
          });
        }
      }

      return {
        branch,
        prUrl: pr.url,
        summary: completedSummary,
        inputTokens: agentResult.inputTokens,
        outputTokens: agentResult.outputTokens,
        cacheReadTokens: agentResult.cacheReadTokens,
        cacheWriteTokens: agentResult.cacheWriteTokens,
        estimatedCostMicros: usage.estimatedCostMicros,
      };
    } finally {
      await mcp.close();
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async buildIssueUrl(run: typeof autofixRuns.$inferSelect): Promise<string> {
    const base = (process.env.WEB_ORIGIN ?? "http://localhost:5174").split(",")[0];

    const [org] = await this.db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, run.organizationId))
      .limit(1);
    const [project] = await this.db
      .select({ slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, run.projectId))
      .limit(1);

    return `${base}/orgs/${org?.slug}/projects/${project?.slug}/issues/${run.issueId}`;
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Autofix timed out after ${ms}ms`)), ms);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
