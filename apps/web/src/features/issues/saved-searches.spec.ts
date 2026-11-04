import { describe, expect, it } from "vitest";

import {
  buildSuggestedSavedSearchName,
  describeFilterSnapshot,
  type IssueFilterSnapshot,
} from "./saved-searches";

const DEFAULTS: IssueFilterSnapshot = {
  q: "",
  status: "all",
  level: "all",
  assignedUserId: "all",
  environment: "all",
  release: "all",
  isRegressed: "false",
  sortBy: "lastSeen",
  sortDir: "desc",
  pageSize: 25,
};

describe("describeFilterSnapshot", () => {
  it("only lists the sort when no filter is set", () => {
    expect(describeFilterSnapshot(DEFAULTS)).toBe("lastSeen desc");
  });

  it("lists every active filter in order", () => {
    expect(
      describeFilterSnapshot({
        ...DEFAULTS,
        q: "timeout",
        status: "open",
        level: "error",
        assignedUserId: "__unassigned__",
        environment: "production",
        release: "1.2.0",
        isRegressed: "true",
      }),
    ).toBe(
      'query "timeout" · open · error · unassigned · env production · release 1.2.0 · regressed · lastSeen desc',
    );
  });
});

describe("buildSuggestedSavedSearchName", () => {
  it("names the search after its most specific filter", () => {
    expect(buildSuggestedSavedSearchName({ ...DEFAULTS, assignedUserId: "__unassigned__" })).toBe(
      "Unassigned queue",
    );
    expect(buildSuggestedSavedSearchName({ ...DEFAULTS, isRegressed: "true" })).toBe("Regressions");
    expect(buildSuggestedSavedSearchName({ ...DEFAULTS, status: "resolved" })).toBe(
      "Resolved review",
    );
    expect(buildSuggestedSavedSearchName({ ...DEFAULTS, q: "db" })).toBe("Search: db");
    expect(buildSuggestedSavedSearchName(DEFAULTS)).toBe("Incoming triage");
  });
});
