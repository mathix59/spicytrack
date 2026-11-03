import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { aiUsageLedger, organizationAiSettings } from "../database/schema";
import { AiUsageService } from "./ai-usage.service";

export type AiBudgetStatus = {
  monthlyBudgetMicros: number | null;
  runCostCapMicros: number | null;
  spentThisMonthMicros: number;
  /** Null when there is no monthly budget. */
  remainingMicros: number | null;
  resetsAt: Date;
  /** False when the selected model has no price: spend cannot be measured, so limits cannot apply. */
  pricingKnown: boolean;
};

/** First instant of the next calendar month, in UTC. Budgets reset then. */
export function nextMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function formatUsd(micros: number) {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

/**
 * The most a run may still spend: what is left of its own cap and of the monthly budget,
 * whichever is lower. Null when neither limit is set.
 */
export function runSpendLimit(
  status: Pick<AiBudgetStatus, "runCostCapMicros" | "remainingMicros">,
  spentOnRunMicros: number,
): number | null {
  const limits = [
    status.runCostCapMicros === null ? null : status.runCostCapMicros - spentOnRunMicros,
    status.remainingMicros,
  ].filter((limit): limit is number => limit !== null);
  return limits.length === 0 ? null : Math.max(0, Math.min(...limits));
}

@Injectable()
export class AiBudgetService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly aiUsageService: AiUsageService,
  ) {}

  async status(organizationId: string, now = new Date()): Promise<AiBudgetStatus> {
    const [settings] = await this.db
      .select({
        provider: organizationAiSettings.provider,
        model: organizationAiSettings.model,
        monthlyBudgetMicros: organizationAiSettings.monthlyBudgetMicros,
        runCostCapMicros: organizationAiSettings.runCostCapMicros,
      })
      .from(organizationAiSettings)
      .where(eq(organizationAiSettings.organizationId, organizationId))
      .limit(1);
    const [spent] = await this.db
      .select({
        micros: sql<number>`coalesce(sum(${aiUsageLedger.estimatedCostMicros}), 0)::bigint`.mapWith(
          Number,
        ),
      })
      .from(aiUsageLedger)
      .where(
        and(
          eq(aiUsageLedger.organizationId, organizationId),
          gte(aiUsageLedger.createdAt, monthStart(now)),
        ),
      );
    const monthlyBudgetMicros = settings?.monthlyBudgetMicros ?? null;
    const spentThisMonthMicros = spent?.micros ?? 0;
    const pricingKnown =
      (await this.aiUsageService.estimateCostMicros({
        organizationId,
        provider: settings?.provider ?? "anthropic",
        model: settings?.model ?? null,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      })) !== null;
    return {
      monthlyBudgetMicros,
      runCostCapMicros: settings?.runCostCapMicros ?? null,
      spentThisMonthMicros,
      remainingMicros:
        monthlyBudgetMicros === null
          ? null
          : Math.max(0, monthlyBudgetMicros - spentThisMonthMicros),
      resetsAt: nextMonthStart(now),
      pricingKnown,
    };
  }

  /**
   * Refuses new AI work once the monthly budget is spent, and when limits are set but the model
   * has no price (they could not be enforced). Returns the status for callers that also cap runs.
   */
  async assertCanSpend(organizationId: string): Promise<AiBudgetStatus> {
    const status = await this.status(organizationId);
    const limited = status.monthlyBudgetMicros !== null || status.runCostCapMicros !== null;
    if (limited && !status.pricingKnown) {
      throw new HttpException(
        "AI spending limits are set, but SpicyTrack has no price for the selected model, so it cannot enforce them. Add a pricing override in the organization's AI settings.",
        HttpStatus.CONFLICT,
      );
    }
    if (status.remainingMicros !== null && status.remainingMicros <= 0) {
      throw new HttpException(
        `This organization spent its monthly AI budget of ${formatUsd(status.monthlyBudgetMicros!)}. It resets on ${status.resetsAt.toISOString().slice(0, 10)}, or an admin can raise it in the AI settings.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return status;
  }
}
