import { describe, expect, it } from "vitest";

import { compareProjectActivity } from "./project-activity";

describe("compareProjectActivity", () => {
  it("orders by 24h events, then open issues, then name", () => {
    const projects = [
      { name: "Quiet", eventCount24h: 0, openIssueCount: 0 },
      { name: "Backlog", eventCount24h: 0, openIssueCount: 40 },
      { name: "Busy", eventCount24h: 900, openIssueCount: 1 },
      { name: "Alpha", eventCount24h: 0, openIssueCount: 0 },
    ];
    expect([...projects].sort(compareProjectActivity).map((project) => project.name)).toEqual([
      "Busy",
      "Backlog",
      "Alpha",
      "Quiet",
    ]);
  });
});
