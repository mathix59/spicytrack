import type { DatabaseClient } from "../database/database.provider";
import { JobsService } from "../jobs/jobs.service";
import {
  AiPricingSyncService,
  DEFAULT_AI_PRICING_CATALOG_URL,
  resolvePricingCatalogUrl,
} from "./ai-pricing-sync.service";

describe("AI pricing catalog synchronization", () => {
  const originalCatalogUrl = process.env.AI_PRICING_CATALOG_URL;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalCatalogUrl === undefined) delete process.env.AI_PRICING_CATALOG_URL;
    else process.env.AI_PRICING_CATALOG_URL = originalCatalogUrl;
  });

  it("uses the official live catalog by default", () => {
    delete process.env.AI_PRICING_CATALOG_URL;

    expect(resolvePricingCatalogUrl()).toBe(DEFAULT_AI_PRICING_CATALOG_URL);
  });

  it("allows live synchronization to be overridden or disabled", () => {
    process.env.AI_PRICING_CATALOG_URL = "https://prices.example.com/catalog.json";
    expect(resolvePricingCatalogUrl()).toBe("https://prices.example.com/catalog.json");

    process.env.AI_PRICING_CATALOG_URL = "disabled";
    expect(resolvePricingCatalogUrl()).toBeNull();
  });

  it("schedules the next daily synchronization after a fetch failure", async () => {
    delete process.env.AI_PRICING_CATALOG_URL;
    const limit = jest.fn().mockResolvedValue([]);
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({ orderBy: jest.fn(() => ({ limit })) })),
        })),
      })),
    } as unknown as DatabaseClient;
    const jobsService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as unknown as JobsService;
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("catalog unavailable"));

    const service = new AiPricingSyncService(db, jobsService);

    await expect(service.sync()).rejects.toThrow("catalog unavailable");
    expect(jobsService.enqueue).toHaveBeenCalledWith(
      "ai_pricing_sync",
      {},
      expect.any(Date),
      expect.objectContaining({ dedupeKey: expect.stringMatching(/^daily-/) }),
    );
  });
});
