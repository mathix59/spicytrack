import { describe, expect, it } from "vitest";

import type { IssueFilterSnapshot } from "./saved-searches";
import { issueFilterSearchParams, pluralizeIssues, positiveNumberParam } from "./issue-filters";

const DEFAULTS: IssueFilterSnapshot = {
  q: "",
  status: "open",
  level: "all",
  assignedUserId: "all",
  environment: "all",
  release: "all",
  isRegressed: "all",
  sortBy: "lastSeenAt",
  sortDir: "desc",
  pageSize: 25,
};

describe("issueFilterSearchParams", () => {
  it("leaves defaults out and keeps keys that are not filters", () => {
    const params = issueFilterSearchParams(
      new URLSearchParams("tab=issues&status=resolved&page=3"),
      DEFAULTS,
      1,
    );
    expect(params.toString()).toBe("tab=issues");
  });

  it("writes every non-default filter and the page in the list's key order", () => {
    const params = issueFilterSearchParams(
      new URLSearchParams(),
      {
        q: "TypeError",
        status: "all",
        level: "error",
        assignedUserId: "__unassigned__",
        environment: "production",
        release: "1.2.0",
        isRegressed: "true",
        sortBy: "timesSeen",
        sortDir: "asc",
        pageSize: 50,
      },
      2,
    );
    expect([...params.keys()]).toEqual([
      "q",
      "status",
      "assignedUserId",
      "environment",
      "release",
      "isRegressed",
      "sortBy",
      "sortDir",
      "page",
      "pageSize",
      "level",
    ]);
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
  });

  it("drops a whitespace-only search", () => {
    const params = issueFilterSearchParams(new URLSearchParams("q=x"), { ...DEFAULTS, q: "  " }, 1);
    expect(params.has("q")).toBe(false);
  });
});

describe("positiveNumberParam", () => {
  it("falls back for missing, malformed or non-positive values", () => {
    expect(positiveNumberParam(null, 25)).toBe(25);
    expect(positiveNumberParam("abc", 1)).toBe(1);
    expect(positiveNumberParam("0", 1)).toBe(1);
    expect(positiveNumberParam("-2", 1)).toBe(1);
    expect(positiveNumberParam("4", 1)).toBe(4);
  });
});

describe("pluralizeIssues", () => {
  it("pluralizes the issue count", () => {
    expect(pluralizeIssues(1)).toBe("1 issue");
    expect(pluralizeIssues(3)).toBe("3 issues");
  });
});
