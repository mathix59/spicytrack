import { describe, expect, it } from "vitest";

import { formatRate, healthVariant } from "./release-health-utils";

describe("formatRate", () => {
  it("rounds down so a few crashes never show as 100%", () => {
    expect(formatRate(0.99999)).toBe("99.99%");
    expect(formatRate(0.994216)).toBe("99.42%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(0)).toBe("0.00%");
  });

  it("shows a dash without data", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
  });
});

describe("healthVariant", () => {
  it("maps crash-free rates to a severity", () => {
    expect(healthVariant(0.995)).toBe("success");
    expect(healthVariant(0.99)).toBe("success");
    expect(healthVariant(0.97)).toBe("warning");
    expect(healthVariant(0.5)).toBe("danger");
    expect(healthVariant(null)).toBe("muted");
  });
});
