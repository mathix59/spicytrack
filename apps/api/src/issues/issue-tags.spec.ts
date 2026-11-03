import { summarizeTagCounts } from "./issue-tags";

describe("summarizeTagCounts", () => {
  it("groups values per key, most frequent first, leading keys first", () => {
    const summary = summarizeTagCounts(
      [
        { key: "feature", value: "checkout", count: 9 },
        { key: "browser", value: "Firefox 121", count: 2 },
        { key: "browser", value: "Chrome 120", count: 8 },
        { key: "environment", value: "production", count: 10 },
        { key: "user.email", value: "ada@example.com", count: 10 },
        { key: "browser.name", value: "Chrome", count: 8 },
      ],
      10,
    );

    expect(summary).toEqual({
      sampledEvents: 10,
      keys: [
        {
          key: "environment",
          total: 10,
          uniqueValues: 1,
          values: [{ value: "production", count: 10 }],
        },
        {
          key: "browser",
          total: 10,
          uniqueValues: 2,
          values: [
            { value: "Chrome 120", count: 8 },
            { value: "Firefox 121", count: 2 },
          ],
        },
        { key: "feature", total: 9, uniqueValues: 1, values: [{ value: "checkout", count: 9 }] },
      ],
    });
  });

  it("keeps the five most frequent values and twenty keys", () => {
    const rows = Array.from({ length: 30 }, (_, key) =>
      Array.from({ length: 8 }, (_, value) => ({
        key: `k${key}`,
        value: `v${value}`,
        count: value + 1,
      })),
    ).flat();
    const summary = summarizeTagCounts(rows, 100);

    expect(summary.keys).toHaveLength(20);
    expect(summary.keys[0].values.map((entry) => entry.value)).toEqual([
      "v7",
      "v6",
      "v5",
      "v4",
      "v3",
    ]);
    expect(summary.keys[0]).toMatchObject({ total: 36, uniqueValues: 8 });
  });
});
