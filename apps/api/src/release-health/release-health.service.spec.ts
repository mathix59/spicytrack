import { crashFreeRate, parseHealthFilters, periodStart } from "./release-health.service";

describe("release health figures", () => {
  it("computes crash-free rates, null without data", () => {
    expect(crashFreeRate(0, 0)).toBeNull();
    expect(crashFreeRate(200, 3)).toBe(0.985);
    expect(crashFreeRate(1, 2)).toBe(0);
  });

  it("aligns periods on whole hours or days, ending with the current one", () => {
    const now = new Date("2026-11-04T12:30:00Z");
    expect(periodStart("24h", now)).toEqual(new Date("2026-11-03T13:00:00Z"));
    expect(periodStart("7d", now)).toEqual(new Date("2026-10-29T00:00:00Z"));
  });

  it("validates filters", () => {
    expect(parseHealthFilters({})).toEqual({ period: "24h", environment: null });
    expect(parseHealthFilters({ period: "30d", environment: " prod " })).toEqual({
      period: "30d",
      environment: "prod",
    });
    expect(() => parseHealthFilters({ period: "1y" })).toThrow("period must be one of");
  });
});
