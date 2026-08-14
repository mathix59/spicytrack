import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { AuditService } from "../audit/audit.service";
import {
  aiModelPricingRules,
  aiUsageLedger,
  organizationAiPricingOverrides,
} from "../database/schema";

// Provider responses evolve quickly. Keep their metered units verbatim (for
// example cache_creation_input_tokens or web_search_requests) rather than
// forcing them through an incomplete universal enum.
export type UsageDimensions = Record<string, number>;
type Rates = Record<string, number>;
type BillingContext = Record<string, string | boolean | number | null | undefined>;
type PricingConfig = {
  baseRatesPerMillion?: Rates;
  derivedUsageRates?: Record<string, { from: string; multiplier: number }>;
  variants?: Array<{ when: BillingContext; baseRatesPerMillion?: Rates; ratesPerMillion?: Rates }>;
  modifiers?: Array<{
    when: BillingContext;
    multiplier: number;
    appliesTo: "all_token_usage" | string[];
  }>;
};

export function normalizeUsage(
  input: UsageDimensions & {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  },
) {
  const cacheRead = input.cache_read_input_tokens ?? input.cacheRead ?? input.cacheReadTokens ?? 0;
  const cacheWrite5m = input.cache_write_5m_input_tokens ?? input.cacheWrite5m ?? 0;
  const cacheWrite1h = input.cache_write_1h_input_tokens ?? input.cacheWrite1h ?? 0;
  const cacheWriteOther =
    input.cache_creation_input_tokens ?? input.cacheWriteOther ?? input.cacheWriteTokens ?? 0;
  const known = new Set([
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "baseInput",
    "cacheWrite5m",
    "cacheWrite1h",
    "cacheRead",
    "cacheWriteOther",
    "output",
    "reasoning",
    "input_tokens",
    "output_tokens",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
    "cache_write_5m_input_tokens",
    "cache_write_1h_input_tokens",
  ]);
  return {
    ...Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => !known.has(key) && typeof value === "number" && value >= 0,
      ),
    ),
    base_input_tokens:
      input.base_input_tokens ??
      input.baseInput ??
      Math.max(
        0,
        (input.input_tokens ?? input.inputTokens ?? 0) -
          cacheRead -
          cacheWrite5m -
          cacheWrite1h -
          cacheWriteOther,
      ),
    cache_write_5m_input_tokens: cacheWrite5m,
    cache_write_1h_input_tokens: cacheWrite1h,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheWriteOther,
    output_tokens: input.output_tokens ?? input.output ?? input.outputTokens ?? 0,
    reasoning_tokens: input.reasoning_tokens ?? input.reasoning ?? 0,
  };
}

function estimate(d: UsageDimensions, rates: Rates) {
  const dollars = Object.entries(d).reduce(
    (sum, [dimension, tokens]) => sum + (tokens * (rates[dimension] ?? 0)) / 1_000_000,
    0,
  );
  return Math.round(dollars * 1_000_000);
}

function matches(context: BillingContext, when: BillingContext) {
  return Object.entries(when).every(([key, value]) => context[key] === value);
}

function resolveRates(
  baseRates: Rates,
  config: PricingConfig,
  dimensions: UsageDimensions,
  context: BillingContext,
) {
  const variant = config.variants?.find((candidate) => matches(context, candidate.when));
  const rates: Rates = {
    ...baseRates,
    ...config.baseRatesPerMillion,
    ...variant?.baseRatesPerMillion,
    ...variant?.ratesPerMillion,
  };
  for (const [dimension, definition] of Object.entries(config.derivedUsageRates ?? {})) {
    rates[dimension] = (rates[definition.from] ?? 0) * definition.multiplier;
  }
  for (const modifier of config.modifiers ?? []) {
    if (!matches(context, modifier.when)) continue;
    const dimensionsToModify =
      modifier.appliesTo === "all_token_usage"
        ? Object.keys(dimensions).filter((key) => key.endsWith("tokens"))
        : modifier.appliesTo;
    for (const dimension of dimensionsToModify) {
      if (rates[dimension] !== undefined) rates[dimension] *= modifier.multiplier;
    }
  }
  return rates;
}

function legacyRates(provider: string, model: string | null): Rates | null {
  try {
    const catalog = JSON.parse(process.env.AI_PRICING_JSON ?? "{}") as Record<
      string,
      Record<string, number>
    >;
    const rates = catalog[`${provider}/${model ?? "default"}`] ?? catalog[`${provider}/default`];
    if (!rates) return null;
    return {
      base_input_tokens: rates.base_input_tokens ?? rates.baseInput ?? rates.input,
      output_tokens: rates.output_tokens ?? rates.output,
      cache_read_input_tokens: rates.cache_read_input_tokens ?? rates.cacheRead,
      cache_creation_input_tokens: rates.cache_creation_input_tokens ?? rates.cacheWrite,
      cache_write_5m_input_tokens: rates.cache_write_5m_input_tokens ?? rates.cacheWrite5m,
      cache_write_1h_input_tokens: rates.cache_write_1h_input_tokens ?? rates.cacheWrite1h,
      reasoning_tokens: rates.reasoning_tokens ?? rates.reasoning,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class AiUsageService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly auditService: AuditService,
  ) {}

  async record(input: {
    organizationId: string;
    projectId?: string | null;
    issueId?: string | null;
    operation: "triage" | "autofix";
    provider: string;
    model: string | null;
    usage?: UsageDimensions;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    billingContext?: BillingContext;
  }) {
    const tokenUsage: UsageDimensions = { ...input.usage };
    if (input.inputTokens !== undefined) tokenUsage.inputTokens = input.inputTokens;
    if (input.outputTokens !== undefined) tokenUsage.outputTokens = input.outputTokens;
    if (input.cacheReadTokens !== undefined) tokenUsage.cacheReadTokens = input.cacheReadTokens;
    if (input.cacheWriteTokens !== undefined) tokenUsage.cacheWriteTokens = input.cacheWriteTokens;
    const dimensions = normalizeUsage(tokenUsage);
    const billingContext = input.billingContext ?? { processingMode: "standard" };
    const pricing = await this.resolvePricing(
      input.organizationId,
      input.provider,
      input.model,
      billingContext,
    );
    const fallback = legacyRates(input.provider, input.model);
    const rates = pricing
      ? resolveRates(pricing.rates, pricing.config, dimensions, billingContext)
      : fallback;
    const estimatedCostMicros = rates ? estimate(dimensions, rates) : null;
    const inputTokens =
      (dimensions.base_input_tokens ?? 0) +
      (dimensions.cache_read_input_tokens ?? 0) +
      (dimensions.cache_write_5m_input_tokens ?? 0) +
      (dimensions.cache_write_1h_input_tokens ?? 0) +
      (dimensions.cache_creation_input_tokens ?? 0);
    const cacheWriteTokens =
      (dimensions.cache_write_5m_input_tokens ?? 0) +
      (dimensions.cache_write_1h_input_tokens ?? 0) +
      (dimensions.cache_creation_input_tokens ?? 0);
    await this.db.insert(aiUsageLedger).values({
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      issueId: input.issueId ?? null,
      operation: input.operation,
      provider: input.provider,
      model: input.model,
      inputTokens,
      outputTokens: dimensions.output_tokens ?? 0,
      cacheReadTokens: dimensions.cache_read_input_tokens ?? 0,
      cacheWriteTokens,
      usageDimensions: dimensions,
      pricingRuleId: pricing?.id ?? null,
      pricingSnapshot: rates
        ? { ratesPerMillion: rates, source: pricing ? "catalog" : "environment" }
        : null,
      billingContext,
      estimatedCostMicros,
    });
    return {
      inputTokens,
      outputTokens: dimensions.output_tokens ?? 0,
      cacheReadTokens: dimensions.cache_read_input_tokens ?? 0,
      cacheWriteTokens,
      dimensions,
      billingContext,
      estimatedCostMicros,
    };
  }

  async summary(organizationId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const [totals] = await this.db
      .select({
        runs: sql<number>`count(*)::int`,
        inputTokens: sql<number>`coalesce(sum(${aiUsageLedger.inputTokens}), 0)::int`,
        outputTokens: sql<number>`coalesce(sum(${aiUsageLedger.outputTokens}), 0)::int`,
        cacheReadTokens: sql<number>`coalesce(sum(${aiUsageLedger.cacheReadTokens}), 0)::int`,
        cacheWriteTokens: sql<number>`coalesce(sum(${aiUsageLedger.cacheWriteTokens}), 0)::int`,
        estimatedCostMicros: sql<number | null>`sum(${aiUsageLedger.estimatedCostMicros})::int`,
      })
      .from(aiUsageLedger)
      .where(
        and(eq(aiUsageLedger.organizationId, organizationId), gte(aiUsageLedger.createdAt, since)),
      );
    const recent = await this.db
      .select()
      .from(aiUsageLedger)
      .where(eq(aiUsageLedger.organizationId, organizationId))
      .orderBy(desc(aiUsageLedger.createdAt))
      .limit(20);
    return { days, totals, recent };
  }

  async listOverrides(organizationId: string) {
    return this.db
      .select()
      .from(organizationAiPricingOverrides)
      .where(eq(organizationAiPricingOverrides.organizationId, organizationId))
      .orderBy(desc(organizationAiPricingOverrides.updatedAt));
  }

  async replaceOverrides(input: {
    organizationId: string;
    actorUserId: string;
    overrides: Array<{
      provider: string;
      model: string;
      conditions?: BillingContext;
      ratesPerMillion: Rates;
      isActive?: boolean;
    }>;
  }) {
    for (const override of input.overrides) {
      if (
        !override.provider ||
        !override.model ||
        !override.ratesPerMillion ||
        Object.values(override.ratesPerMillion).some((rate) => typeof rate !== "number" || rate < 0)
      ) {
        throw new BadRequestException(
          "Each pricing override requires provider, model, and non-negative numeric rates",
        );
      }
    }
    await this.db.transaction(async (tx) => {
      await tx
        .delete(organizationAiPricingOverrides)
        .where(eq(organizationAiPricingOverrides.organizationId, input.organizationId));
      if (input.overrides.length) {
        await tx.insert(organizationAiPricingOverrides).values(
          input.overrides.map((override) => ({
            organizationId: input.organizationId,
            provider: override.provider,
            model: override.model,
            conditions: override.conditions ?? {},
            ratesPerMillion: override.ratesPerMillion,
            isActive: override.isActive ?? true,
            updatedByUserId: input.actorUserId,
          })),
        );
      }
    });
    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "org.ai_pricing_overrides.updated",
      targetType: "organization_ai_pricing_overrides",
      payload: { count: input.overrides.length },
    });
    return this.listOverrides(input.organizationId);
  }

  private async resolvePricing(
    organizationId: string,
    provider: string,
    model: string | null,
    context: BillingContext,
  ) {
    const overrides = await this.db
      .select()
      .from(organizationAiPricingOverrides)
      .where(
        and(
          eq(organizationAiPricingOverrides.organizationId, organizationId),
          eq(organizationAiPricingOverrides.provider, provider),
          eq(organizationAiPricingOverrides.model, model ?? "default"),
          eq(organizationAiPricingOverrides.isActive, true),
        ),
      );
    const override = overrides
      .filter((candidate) => matches(context, candidate.conditions as BillingContext))
      .sort(
        (a, b) =>
          Object.keys(b.conditions as object).length - Object.keys(a.conditions as object).length,
      )[0];
    if (override)
      return {
        id: override.id,
        rates: override.ratesPerMillion as Rates,
        config: {} as PricingConfig,
      };
    const now = new Date();
    const rows = await this.db
      .select()
      .from(aiModelPricingRules)
      .where(
        and(
          eq(aiModelPricingRules.provider, provider),
          eq(aiModelPricingRules.model, model ?? "default"),
          lte(aiModelPricingRules.effectiveFrom, now),
          or(isNull(aiModelPricingRules.effectiveTo), gte(aiModelPricingRules.effectiveTo, now)),
        ),
      )
      .orderBy(desc(aiModelPricingRules.effectiveFrom))
      .limit(1);
    const rule = rows[0];
    return rule
      ? {
          id: rule.id,
          rates: rule.ratesPerMillion as Rates,
          config: rule.pricingConfig as PricingConfig,
        }
      : null;
  }
}
