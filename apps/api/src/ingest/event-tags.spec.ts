import { buildEventTags } from "./event-tags";

describe("buildEventTags", () => {
  it("derives tags from the payload and keeps explicit tags on top", () => {
    expect(
      buildEventTags({
        level: "warning",
        environment: "production",
        release: "web@1.2.0",
        user: { id: 42, email: "ada@example.com" },
        contexts: {
          browser: { name: "Chrome", version: "120.0" },
          os: { name: "macOS" },
        },
        request: { url: "https://app.example.com/checkout?token=secret#step" },
        tags: { environment: "staging", feature: "checkout", retries: 3, nested: { a: 1 } },
      }),
    ).toEqual({
      level: "warning",
      environment: "staging",
      release: "web@1.2.0",
      "user.id": "42",
      "user.email": "ada@example.com",
      browser: "Chrome 120.0",
      "browser.name": "Chrome",
      os: "macOS",
      "os.name": "macOS",
      url: "https://app.example.com/checkout",
      feature: "checkout",
      retries: "3",
    });
  });

  it("accepts Sentry's array tag format and caps sizes", () => {
    const tags = buildEventTags({
      tags: [["release-channel", "x".repeat(500)], ["bad"], [1, "ignored"]],
    });

    expect(tags["release-channel"]).toHaveLength(200);
    expect(Object.keys(tags)).toEqual(["level", "release-channel"]);
    expect(
      Object.keys(
        buildEventTags({
          tags: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, "v"])),
        }),
      ),
    ).toHaveLength(50);
  });
});
