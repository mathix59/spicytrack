import { describe, expect, it } from "vitest";

import { toContextSummary } from "./utils";

describe("toContextSummary", () => {
  it("summarizes the identifying contexts and the user, skipping absent values", () => {
    expect(
      toContextSummary({
        contexts: {
          browser: { name: "Chrome", version: "120.0.6099" },
          os: { name: "macOS", version: "14.2" },
          runtime: { name: "node", version: "v20.11.0" },
          device: { brand: "Apple", model: "MacBookPro18,3" },
          trace: { trace_id: "abc" },
        },
        user: { id: 42, email: "ada@example.test" },
      }),
    ).toEqual([
      { label: "Browser", value: "Chrome 120.0.6099" },
      { label: "OS", value: "macOS 14.2" },
      { label: "Runtime", value: "node v20.11.0" },
      { label: "Device", value: "Apple MacBookPro18,3" },
      { label: "User", value: "ada@example.test" },
    ]);
  });

  it("falls back to raw descriptions and user ids, and is empty without contexts", () => {
    expect(
      toContextSummary({
        contexts: { os: { raw: "Linux 6.1.0" }, browser: { version: "1" } },
        user: { id: 42 },
      }),
    ).toEqual([
      { label: "OS", value: "Linux 6.1.0" },
      { label: "User", value: "42" },
    ]);
    expect(toContextSummary({})).toEqual([]);
  });
});
