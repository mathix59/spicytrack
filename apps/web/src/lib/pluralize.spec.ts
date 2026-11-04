import { describe, expect, it } from "vitest";

import { pluralize } from "./pluralize";

describe("pluralize", () => {
  it("uses the singular for exactly one", () => {
    expect(pluralize(1, "event")).toBe("1 event");
  });

  it("uses the plural for zero, many and fractions", () => {
    expect(pluralize(0, "event")).toBe("0 events");
    expect(pluralize(2, "event")).toBe("2 events");
    expect(pluralize(1.5, "session")).toBe("1.5 sessions");
  });

  it("groups thousands", () => {
    expect(pluralize(12_345, "issue")).toBe("12,345 issues");
  });

  it("takes an irregular plural", () => {
    expect(pluralize(1, "entry", "entries")).toBe("1 entry");
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
  });
});
