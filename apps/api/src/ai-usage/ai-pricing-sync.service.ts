import { Inject, Injectable, Logger } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";

import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { aiModelPricingRules, aiPricingCatalogVersions } from "../database/schema";
import { JobsService } from "../jobs/jobs.service";

const JOB_TYPE = "ai_pricing_sync";
const DAILY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_AI_PRICING_CATALOG_URL =
  "https://raw.githubusercontent.com/mathix59/spicytrack/main/pricing/catalog.json";
type ManifestRule = {
  provider: string;
  model: string;
  currency?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  ratesPerMillion?: Record<string, number>;
  pricingConfig?: Record<string, unknown>;
};
type Manifest = { schemaVersion: number; version?: string; models: ManifestRule[] };

function parseManifest(value: unknown): Manifest {
  if (!value || typeof value !== "object") throw new Error("Pricing catalog must be an object");
  const manifest = value as Partial<Manifest>;
  if (!Number.isInteger(manifest.schemaVersion) || !Array.isArray(manifest.models)) {
    throw new Error("Pricing catalog must provide schemaVersion and models");
  }
  for (const rule of manifest.models) {
    if (
      !rule ||
      typeof rule.provider !== "string" ||
      typeof rule.model !== "string" ||
      !rule.effectiveFrom ||
      (!rule.ratesPerMillion && !rule.pricingConfig)
    ) {
      throw new Error("Pricing catalog contains an invalid model rule");
    }
    if (
      Object.values(rule.ratesPerMillion ?? {}).some((rate) => typeof rate !== "number" || rate < 0)
    ) {
      throw new Error(`Pricing catalog contains invalid rates for ${rule.provider}/${rule.model}`);
    }
  }
  return manifest as Manifest;
}

export function resolvePricingCatalogUrl() {
  const configured = process.env.AI_PRICING_CATALOG_URL?.trim();
  if (configured && ["off", "disabled"].includes(configured.toLowerCase())) return null;
  return configured || DEFAULT_AI_PRICING_CATALOG_URL;
}

@Injectable()
export class AiPricingSyncService {
  private readonly logger = new Logger(AiPricingSyncService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly jobsService: JobsService,
  ) {}

  async ensureScheduled() {
    if (!resolvePricingCatalogUrl()) return;
    if (!(await this.jobsService.hasPending(JOB_TYPE))) {
      await this.jobsService.enqueue(JOB_TYPE, {}, new Date(), { dedupeKey: "daily" });
    }
  }

  async sync() {
    const sourceUrl = resolvePricingCatalogUrl();
    if (!sourceUrl) return { status: "disabled" as const };
    try {
      const [previous] = await this.db
        .select()
        .from(aiPricingCatalogVersions)
        .where(eq(aiPricingCatalogVersions.sourceUrl, sourceUrl))
        .orderBy(desc(aiPricingCatalogVersions.fetchedAt))
        .limit(1);
      const response = await fetch(sourceUrl, {
        headers: previous?.etag ? { "if-none-match": previous.etag } : undefined,
      });
      if (response.status === 304) return { status: "unchanged" as const };
      if (!response.ok) throw new Error(`Pricing catalog fetch failed (${response.status})`);
      const manifest = parseManifest(await response.json());
      const sourceRevision =
        response.headers.get("x-github-commit") ??
        response.headers.get("etag") ??
        manifest.version ??
        null;
      if (sourceRevision && previous?.sourceRevision === sourceRevision)
        return { status: "unchanged" as const };
      const [catalog] = await this.db
        .insert(aiPricingCatalogVersions)
        .values({
          sourceUrl,
          sourceRevision,
          etag: response.headers.get("etag"),
          schemaVersion: manifest.schemaVersion,
          payload: manifest,
        })
        .returning();
      await this.db.insert(aiModelPricingRules).values(
        manifest.models.map((rule) => ({
          catalogVersionId: catalog.id,
          provider: rule.provider,
          model: rule.model,
          currency: rule.currency ?? "USD",
          effectiveFrom: new Date(rule.effectiveFrom),
          effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : null,
          ratesPerMillion: rule.ratesPerMillion ?? {},
          pricingConfig: rule.pricingConfig ?? {},
        })),
      );
      this.logger.log(`Synced ${manifest.models.length} AI pricing rules from ${sourceUrl}`);
      return { status: "updated" as const, catalogVersionId: catalog.id };
    } finally {
      await this.scheduleNext();
    }
  }

  private async scheduleNext() {
    await this.jobsService.enqueue(JOB_TYPE, {}, new Date(Date.now() + DAILY_MS), {
      dedupeKey: `daily-${new Date(Date.now() + DAILY_MS).toISOString().slice(0, 10)}`,
    });
  }
}
