import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { AiBudgetService, formatUsd, runSpendLimit } from "../ai-usage/ai-budget.service";
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
import type { CommitChecks, VcsProviderKind } from "../integrations/vcs/vcs-provider.interface";
import { VcsRequestError } from "../integrations/vcs/vcs-provider.interface";
import { VcsFactory } from "../integrations/vcs/vcs.factory";
import type { Job } from "../jobs/jobs.service";
import { JobsService } from "../jobs/jobs.service";
import { type AgentResult, type RootCauseAnalysis, resolveModel, runAutofixAgent } from "./agent";
import { AutofixService } from "./autofix.service";
import { commitFiles, headSha, pushBranch, scrubSecret, shallowClone } from "./git";
import { CodebaseMemoryMcp } from "./mcp-client";
import { buildTaskPrompt } from "./prompt";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
export const CHECKS_JOB = "autofix_checks";
const CHECKS_POLL_MS = 30_000;
const DEFAULT_CHECKS_TIMEOUT_MINUTES = 60;
/** CI usually reports within seconds of a push; after this long, assume the repo has none. */
const NO_CHECKS_GRACE_MS = 5 * 60 * 1000;

type AutofixRun = typeof autofixRuns.$inferSelect;

function checksTimeoutMs() {
  const minutes = Number(
    process.env.AUTOFIX_CHECKS_TIMEOUT_MINUTES ?? DEFAULT_CHECKS_TIMEOUT_MINUTES,
  );
  return (
    (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_CHECKS_TIMEOUT_MINUTES) * 60_000
  );
}

/** What the checks mean for the run once they settled, or null to keep waiting. */
export function checksDecision(
  checks: CommitChecks,
  input: { requirePassingChecks: boolean; startedAt: Date; deadlineAt: Date; now: Date },
): { outcome: "open_pr"; verified: boolean } | { outcome: "fail"; reason: string } | null {
  if (checks.state === "success") return { outcome: "open_pr", verified: true };
  if (checks.state === "failure") {
    return {
      outcome: "fail",
      reason: `CI failed on the autofix branch (${checks.failed.join(", ")}). No pull request was opened.`,
    };
  }
  if (
    checks.state === "none" &&
    input.now.getTime() - input.startedAt.getTime() >= NO_CHECKS_GRACE_MS
  ) {
    return input.requirePassingChecks
      ? {
          outcome: "fail",
          reason:
            'No CI check ran on the autofix branch, so its tests could not be verified. No pull request was opened. Add CI to the repository, or turn off "Require passing CI checks" in the project\'s Autofix settings.',
        }
      : { outcome: "open_pr", verified: false };
  }
  if (input.now >= input.deadlineAt) {
    return {
      outcome: "fail",
      reason: `CI did not finish on the autofix branch in time (still pending: ${checks.pending.join(", ") || "none reported"}). No pull request was opened.`,
    };
  }
  return null;
}

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
    private readonly aiBudgetService: AiBudgetService,
    private readonly jobsService: JobsService,
  ) {}

  async run(job: Job, jobSignal?: AbortSignal): Promise<void> {
    const runId = (job.payload as { runId?: string }).runId;

    if (!runId) {
      throw new Error("autofix job payload is missing runId");
    }

    // Claiming the queued row makes a duplicate delivery of the same job a no-op.
    const [run] = await this.db
      .update(autofixRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(and(eq(autofixRuns.id, runId), eq(autofixRuns.status, "queued")))
      .returning();

    if (!run) {
      this.logger.warn(`Autofix run ${runId} is not queued; skipping`);
      return;
    }

    let token = "";

    try {
      const timeoutMs = Number(process.env.AUTOFIX_JOB_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
      await this.withTimeout(
        (signal) =>
          this.execute(
            run,
            (usedToken) => {
              token = usedToken;
            },
            jobSignal ? AbortSignal.any([signal, jobSignal]) : signal,
          ),
        timeoutMs,
      );
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      await this.fail(run, scrubSecret(raw, token));
    }
  }

  /** Polls CI on the pushed branch, then opens the pull request or fails the run. */
  async checkRun(job: Job): Promise<void> {
    const runId = (job.payload as { runId?: string }).runId;
    if (!runId) throw new Error("autofix_checks job payload is missing runId");

    const [run] = await this.db
      .select()
      .from(autofixRuns)
      .where(eq(autofixRuns.id, runId))
      .limit(1);
    if (!run || run.status !== "checking" || !run.commitSha || !run.branch) return;

    const connection = await this.integrationsService.getAutofixConnection(
      run.projectId,
      run.organizationId,
    );
    if (!connection) {
      await this.fail(run, "Repo connection was removed while waiting for CI.");
      return;
    }

    const now = new Date();
    const deadlineAt = run.checksDeadlineAt ?? now;
    const provider = this.vcsFactory.getProvider(connection.provider as VcsProviderKind);
    let checks: CommitChecks;
    try {
      checks = await provider.getCommitChecks(connection.input, run.commitSha);
    } catch (error) {
      const message = scrubSecret(
        error instanceof Error ? error.message : String(error),
        connection.input.token,
      );
      if (error instanceof VcsRequestError && (error.status === 403 || error.status === 404)) {
        await this.fail(
          run,
          `SpicyTrack cannot read CI results on the repository. GitHub Apps need the "Checks" and "Commit statuses" read permissions; GitLab tokens need read_api. ${message}`,
        );
        return;
      }
      // Transient: try again until the deadline.
      if (now >= deadlineAt) {
        await this.fail(run, `Could not read CI results before the deadline: ${message}`);
      } else {
        await this.scheduleCheck(run);
      }
      return;
    }

    const config = await this.autofixService.getConfig(run.projectId);
    const decision = checksDecision(checks, {
      requirePassingChecks: config.requirePassingChecks,
      startedAt: run.checksStartedAt ?? now,
      deadlineAt,
      now,
    });

    await this.db
      .update(autofixRuns)
      .set({ checksStatus: checks.state, checksSummary: checks })
      .where(eq(autofixRuns.id, run.id));

    if (!decision) {
      await this.scheduleCheck(run);
      return;
    }
    if (decision.outcome === "fail") {
      await this.fail(run, decision.reason);
      return;
    }

    try {
      await this.openPullRequest(run, connection, checks, decision.verified, config);
    } catch (error) {
      await this.fail(
        run,
        scrubSecret(error instanceof Error ? error.message : String(error), connection.input.token),
      );
    }
  }

  private async scheduleCheck(run: AutofixRun) {
    await this.jobsService.enqueue(
      CHECKS_JOB,
      { runId: run.id },
      new Date(Date.now() + CHECKS_POLL_MS),
      { organizationId: run.organizationId, projectId: run.projectId },
    );
  }

  private async fail(run: AutofixRun, rawMessage: string) {
    const message = rawMessage.slice(0, 2000);
    this.logger.error(`Autofix run ${run.id} failed: ${message}`);

    await this.db
      .update(autofixRuns)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(autofixRuns.id, run.id));

    await this.auditService.record({
      organizationId: run.organizationId,
      projectId: run.projectId,
      actorUserId: run.fixRequestedByUserId ?? run.triggeredByUserId,
      action: "autofix.failed",
      targetType: "autofix_run",
      targetId: run.id,
      payload: { issueId: run.issueId, phase: run.phase, error: message },
    });
  }

  private async execute(
    run: AutofixRun,
    onToken: (token: string) => void,
    signal: AbortSignal,
  ): Promise<void> {
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

    const spentOnRun = run.estimatedCostMicros ?? 0;
    const budget = await this.aiBudgetService.status(run.organizationId);
    const limitMicros = runSpendLimit(budget, spentOnRun);
    if (limitMicros !== null && !budget.pricingKnown) {
      throw new Error(
        "AI spending limits are set, but the selected model has no known price. Add a pricing override in the organization's AI settings.",
      );
    }
    if (limitMicros !== null && limitMicros <= 0) {
      throw new Error(
        budget.remainingMicros === 0
          ? "The organization's monthly AI budget is spent."
          : `This run already reached its ${formatUsd(budget.runCostCapMicros ?? 0)} cost cap.`,
      );
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

      const mode = run.phase === "analysis" ? "analysis" : "fix";
      const priorAnalysis = run.analysis as RootCauseAnalysis | null;
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
        mode,
        analysis: priorAnalysis,
      });

      const agentResult = await runAutofixAgent({
        mode,
        model: resolveModel(aiConfig),
        repoDir,
        mcp,
        taskPrompt,
        abortSignal: signal,
        spendLimit:
          limitMicros === null
            ? null
            : {
                limitMicros,
                estimateCostMicros: (usage) =>
                  this.aiUsageService.estimateCostMicros({
                    organizationId: run.organizationId,
                    provider: aiConfig.provider,
                    model: aiConfig.model,
                    ...usage,
                  }),
              },
      });
      const usage = await this.aiUsageService.record({
        organizationId: run.organizationId,
        projectId: run.projectId,
        issueId: run.issueId,
        operation: "autofix",
        provider: aiConfig.provider,
        model: aiConfig.model,
        billingContext: { processingMode: "standard", phase: mode },
        inputTokens: agentResult.inputTokens,
        outputTokens: agentResult.outputTokens,
        cacheReadTokens: agentResult.cacheReadTokens,
        cacheWriteTokens: agentResult.cacheWriteTokens,
      });
      await this.addUsage(run, agentResult, usage.estimatedCostMicros);

      if (agentResult.stoppedForBudget) {
        throw new Error(
          budget.remainingMicros !== null && budget.remainingMicros <= limitMicros!
            ? "Stopped: the organization's monthly AI budget is spent."
            : `Stopped: this run reached its ${formatUsd(budget.runCostCapMicros ?? 0)} cost cap.`,
        );
      }

      const summary = analysisCapabilityWarning
        ? `${agentResult.summary}\n\n> Analysis capability warning: ${analysisCapabilityWarning}`
        : agentResult.summary;

      if (mode === "analysis") {
        await this.completeAnalysis(run, agentResult.analysis!, summary, config);
        return;
      }

      // Unique per attempt: a retried fix must not collide with the branch of the failed one.
      const branch = `autofix/issue-${run.issueId.slice(0, 8)}-${run.id.slice(0, 8)}-${Date.now().toString(36)}`;
      const committed = await commitFiles(
        repoDir,
        agentResult.filesChanged,
        `fix: ${issue.title} (SpicyTrack autofix)`,
      );

      if (!committed) {
        throw new Error(
          `The agent made no code changes. Agent report: ${agentResult.summary.slice(0, 500)}`,
        );
      }

      await pushBranch(repoDir, authenticatedUrl, branch);
      const commitSha = await headSha(repoDir);
      const now = new Date();

      // The pull request waits for the repository's own CI on this exact commit.
      await this.db
        .update(autofixRuns)
        .set({
          status: "checking",
          branch,
          commitSha,
          summary,
          checksStatus: "pending",
          checksSummary: null,
          checksStartedAt: now,
          checksDeadlineAt: new Date(now.getTime() + checksTimeoutMs()),
        })
        .where(eq(autofixRuns.id, run.id));
      await this.scheduleCheck(run);
    } finally {
      await mcp.close();
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async addUsage(run: AutofixRun, result: AgentResult, costMicros: number | null) {
    const [current] = await this.db
      .select({
        inputTokens: autofixRuns.inputTokens,
        outputTokens: autofixRuns.outputTokens,
        cacheReadTokens: autofixRuns.cacheReadTokens,
        cacheWriteTokens: autofixRuns.cacheWriteTokens,
        estimatedCostMicros: autofixRuns.estimatedCostMicros,
      })
      .from(autofixRuns)
      .where(eq(autofixRuns.id, run.id))
      .limit(1);
    await this.db
      .update(autofixRuns)
      .set({
        inputTokens: (current?.inputTokens ?? 0) + result.inputTokens,
        outputTokens: (current?.outputTokens ?? 0) + result.outputTokens,
        cacheReadTokens: (current?.cacheReadTokens ?? 0) + result.cacheReadTokens,
        cacheWriteTokens: (current?.cacheWriteTokens ?? 0) + result.cacheWriteTokens,
        estimatedCostMicros:
          costMicros === null && current?.estimatedCostMicros == null
            ? null
            : (current?.estimatedCostMicros ?? 0) + (costMicros ?? 0),
      })
      .where(eq(autofixRuns.id, run.id));
  }

  private async completeAnalysis(
    run: AutofixRun,
    analysis: RootCauseAnalysis,
    summary: string,
    config: { autoFixAfterAnalysis: boolean },
  ) {
    await this.db
      .update(autofixRuns)
      .set({ status: "analyzed", analysis, summary, finishedAt: new Date() })
      .where(eq(autofixRuns.id, run.id));

    await this.db.insert(issueActivity).values({
      organizationId: run.organizationId,
      projectId: run.projectId,
      issueId: run.issueId,
      actorUserId: run.triggeredByUserId,
      type: "autofix_analyzed",
      payload: { runId: run.id, confidence: analysis.confidence, fixable: analysis.fixable },
    });
    await this.auditService.record({
      organizationId: run.organizationId,
      projectId: run.projectId,
      actorUserId: run.triggeredByUserId,
      action: "autofix.analyzed",
      targetType: "autofix_run",
      targetId: run.id,
      payload: { issueId: run.issueId, confidence: analysis.confidence, fixable: analysis.fixable },
    });

    // Only a confident, in-repo diagnosis continues on its own.
    if (config.autoFixAfterAnalysis && analysis.fixable && analysis.confidence !== "low") {
      try {
        await this.autofixService.startFix({
          organizationId: run.organizationId,
          projectId: run.projectId,
          runId: run.id,
          actorUserId: null,
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Autofix run ${run.id}: automatic fix not started: ${detail}`);
      }
    }
  }

  private async openPullRequest(
    run: AutofixRun,
    connection: NonNullable<Awaited<ReturnType<IntegrationsService["getAutofixConnection"]>>>,
    checks: CommitChecks,
    verified: boolean,
    config: { autoMerge: boolean; targetBranch: string | null },
  ) {
    const [issue] = await this.db
      .select({ title: issues.title })
      .from(issues)
      .where(eq(issues.id, run.issueId))
      .limit(1);
    const title = issue?.title ?? "SpicyTrack issue";
    const targetBranch = config.targetBranch ?? connection.defaultBranch;
    const provider = this.vcsFactory.getProvider(connection.provider as VcsProviderKind);
    const analysis = run.analysis as RootCauseAnalysis | null;
    const checksNote = verified
      ? `CI passed on ${run.commitSha!.slice(0, 12)} (${checks.total} check${checks.total === 1 ? "" : "s"}).`
      : "No CI check ran on this branch: its tests were not verified, so it will not be merged automatically.";
    const issueUrl = await this.buildIssueUrl(run);
    const body = [
      analysis ? `## Root cause\n\n${analysis.rootCause}` : null,
      `## Fix\n\n${run.summary ?? ""}`,
      `## Checks\n\n${checksNote}`,
      `---\nGenerated by SpicyTrack Autofix for issue [${title}](${issueUrl}).`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const pr = await provider.createPullRequest(connection.input, {
      sourceBranch: run.branch!,
      targetBranch,
      title: `Autofix: ${title}`.slice(0, 250),
      body,
    });

    let completedSummary = `${run.summary ?? ""}\n\n${checksNote}`;
    // Merging is only ever automatic on a commit whose CI passed.
    if (config.autoMerge && verified) {
      try {
        await provider.mergePullRequest(connection.input, pr.id);
        completedSummary += `\n\nAutomatically squash-merged into ${targetBranch}.`;
        await this.auditService.record({
          organizationId: run.organizationId,
          projectId: run.projectId,
          actorUserId: run.fixRequestedByUserId ?? run.triggeredByUserId,
          action: "autofix.pull_request.auto_merged",
          targetType: "autofix_run",
          targetId: run.id,
          payload: { issueId: run.issueId, prUrl: pr.url, targetBranch, commitSha: run.commitSha },
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
          actorUserId: run.fixRequestedByUserId ?? run.triggeredByUserId,
          action: "autofix.pull_request.auto_merge_failed",
          targetType: "autofix_run",
          targetId: run.id,
          payload: { issueId: run.issueId, prUrl: pr.url, targetBranch, error: autoMergeError },
        });
      }
    }

    await this.db
      .update(autofixRuns)
      .set({
        status: "succeeded",
        prUrl: pr.url,
        summary: completedSummary,
        finishedAt: new Date(),
      })
      .where(eq(autofixRuns.id, run.id));

    await this.db.insert(issueActivity).values({
      organizationId: run.organizationId,
      projectId: run.projectId,
      issueId: run.issueId,
      actorUserId: run.fixRequestedByUserId ?? run.triggeredByUserId,
      type: "autofix_completed",
      payload: { runId: run.id, prUrl: pr.url, branch: run.branch },
    });

    await this.auditService.record({
      organizationId: run.organizationId,
      projectId: run.projectId,
      actorUserId: run.fixRequestedByUserId ?? run.triggeredByUserId,
      action: "autofix.succeeded",
      targetType: "autofix_run",
      targetId: run.id,
      payload: { issueId: run.issueId, prUrl: pr.url, checksVerified: verified },
    });
  }

  private async buildIssueUrl(run: AutofixRun): Promise<string> {
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

  /** Rejects after `ms` and aborts the signal, which stops the model calls still in flight. */
  private async withTimeout<T>(task: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        task(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(`Autofix timed out after ${ms}ms`);
            controller.abort(error);
            reject(error);
          }, ms);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
