import { describe, expect, it } from "vitest";

import {
  issueListContext,
  issueListContextFilters,
  withIssueListContext,
} from "./issue-list-context";

describe("issue list context", () => {
  it("keeps only the list filters that are set", () => {
    const context = issueListContext(
      new URLSearchParams("q=timeout&status=&level=error&page=3&sortBy=lastSeen"),
    );

    expect(context.toString()).toBe("q=timeout&level=error&sortBy=lastSeen");
  });

  it("appends the context to a path only when there is one", () => {
    expect(withIssueListContext("/issues/1", new URLSearchParams())).toBe("/issues/1");
    expect(withIssueListContext("/issues/1", new URLSearchParams("level=error"))).toBe(
      "/issues/1?level=error",
    );
  });

  it("defaults to open issues and turns all into no status filter", () => {
    expect(issueListContextFilters(new URLSearchParams()).status).toBe("open");
    expect(issueListContextFilters(new URLSearchParams("status=all")).status).toBeUndefined();
  });

  it("parses the regression flag", () => {
    expect(issueListContextFilters(new URLSearchParams()).isRegressed).toBeUndefined();
    expect(issueListContextFilters(new URLSearchParams("isRegressed=true")).isRegressed).toBe(true);
    expect(issueListContextFilters(new URLSearchParams("isRegressed=false")).isRegressed).toBe(
      false,
    );
  });
});
