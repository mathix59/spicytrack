import { HttpException } from "@nestjs/common";
import { parseUsdLimit } from "../autofix/organization-ai-settings.controller";
import { AiBudgetService, monthStart, nextMonthStart, runSpendLimit } from "./ai-budget.service";

describe("budget periods", () => {
  it("resets on the first day of the next month, in UTC", () => {
    const now = new Date("2026-12-31T23:30:00Z");
    expect(monthStart(now).toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(nextMonthStart(now).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("runSpendLimit", () => {
  it("has no limit when neither the run cap nor the monthly budget is set", () => {
    expect(runSpendLimit({ runCostCapMicros: null, remainingMicros: null }, 0)).toBeNull();
  });

  it("subtracts what the run already spent from its cap", () => {
    expect(runSpendLimit({ runCostCapMicros: 2_000_000, remainingMicros: null }, 500_000)).toBe(
      1_500_000,
    );
  });

  it("takes the lower of the run cap and the monthly remainder", () => {
    expect(runSpendLimit({ runCostCapMicros: 2_000_000, remainingMicros: 300_000 }, 0)).toBe(
      300_000,
    );
    expect(runSpendLimit({ runCostCapMicros: 2_000_000, remainingMicros: 0 }, 2_500_000)).toBe(0);
  });
});

describe("AiBudgetService.assertCanSpend", () => {
  function serviceWith(
    settings: { monthlyBudgetMicros: number | null; runCostCapMicros: number | null } | null,
    spentMicros: number,
    price: number | null = 0,
  ) {
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () =>
                settings ? [{ provider: "anthropic", model: null, ...settings }] : [],
            }),
          }),
        })
        .mockReturnValueOnce({ from: () => ({ where: async () => [{ micros: spentMicros }] }) }),
    };
    return new AiBudgetService(
      db as never,
      { estimateCostMicros: jest.fn().mockResolvedValue(price) } as never,
    );
  }

  it("allows spending without limits", async () => {
    await expect(serviceWith(null, 9_000_000).assertCanSpend("org")).resolves.toMatchObject({
      remainingMicros: null,
    });
  });

  it("refuses once the monthly budget is spent", async () => {
    const service = serviceWith(
      { monthlyBudgetMicros: 10_000_000, runCostCapMicros: null },
      10_000_000,
    );
    await expect(service.assertCanSpend("org")).rejects.toThrow(
      /spent its monthly AI budget of \$10\.00/,
    );
  });

  it("refuses limits it cannot enforce because the model has no price", async () => {
    const service = serviceWith(
      { monthlyBudgetMicros: null, runCostCapMicros: 1_000_000 },
      0,
      null,
    );
    const error = await service.assertCanSpend("org").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
  });
});

describe("parseUsdLimit", () => {
  it("keeps, clears or rounds a limit", () => {
    expect(parseUsdLimit(undefined, "cap", 1000)).toBeUndefined();
    expect(parseUsdLimit(null, "cap", 1000)).toBeNull();
    expect(parseUsdLimit("", "cap", 1000)).toBeNull();
    expect(parseUsdLimit(12.345, "cap", 1000)).toBe(12.35);
  });

  it.each([0, -1, 1001, "abc"])("rejects %s", (value) => {
    expect(() => parseUsdLimit(value, "cap", 1000)).toThrow("cap must be between 0.01 and 1000");
  });
});
