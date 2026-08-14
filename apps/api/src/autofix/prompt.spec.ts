import { buildTaskPrompt } from "./prompt";

describe("buildTaskPrompt", () => {
  it("formats issue, exception, and stack trace", () => {
    const prompt = buildTaskPrompt({
      issue: {
        title: "TypeError: Cannot read properties of undefined (reading 'id')",
        culprit: "handleCheckout (src/checkout.ts)",
        level: "error",
        timesSeen: 42,
        firstSeenAt: new Date("2026-07-01T00:00:00Z"),
        lastSeenAt: new Date("2026-07-12T00:00:00Z"),
      },
      event: {
        message: null,
        rawPayload: {
          exception: {
            values: [
              {
                type: "TypeError",
                value: "Cannot read properties of undefined (reading 'id')",
              },
            ],
          },
          tags: { environment: "production" },
        },
      },
      resolvedFrames: [
        {
          filename: "src/checkout.ts",
          function: "handleCheckout",
          lineno: 87,
          colno: 12,
          resolved: true,
          resolution: "sourcemap",
          diagnostic: "resolved",
        },
      ],
    });

    expect(prompt).toContain("TypeError");
    expect(prompt).toContain("Occurrences: 42");
    expect(prompt).toContain("at handleCheckout (src/checkout.ts:87:12)");
    expect(prompt).toContain("## Tags");
    expect(prompt).toContain("report_fix");
  });

  it("handles events without stack traces", () => {
    const prompt = buildTaskPrompt({
      issue: {
        title: "Something failed",
        culprit: null,
        level: "error",
        timesSeen: 1,
        firstSeenAt: null,
        lastSeenAt: null,
      },
      event: { message: "Something failed", rawPayload: {} },
      resolvedFrames: [],
    });

    expect(prompt).toContain("(no stack trace available)");
    expect(prompt).toContain("Culprit: unknown");
  });
});
