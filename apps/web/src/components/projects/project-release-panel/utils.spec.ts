import { describe, expect, it } from "vitest";

import { releaseIssuesHref, sortReleasesByLastSeen, splitReleaseVersion } from "./utils";

describe("splitReleaseVersion", () => {
  it("splits a package from its version", () => {
    expect(splitReleaseVersion("checkout-ui@2.4.1")).toEqual({
      packageName: "checkout-ui@",
      version: "2.4.1",
    });
    expect(splitReleaseVersion("@acme/web@1.0.0-rc.1")).toEqual({
      packageName: "@acme/web@",
      version: "1.0.0-rc.1",
    });
  });

  it("keeps a bare version whole", () => {
    expect(splitReleaseVersion("1.4.0")).toEqual({ packageName: "", version: "1.4.0" });
    expect(splitReleaseVersion("@scope")).toEqual({ packageName: "", version: "@scope" });
    expect(splitReleaseVersion("trailing@")).toEqual({ packageName: "", version: "trailing@" });
  });
});

describe("sortReleasesByLastSeen", () => {
  it("puts the most recently seen first and unseen releases last", () => {
    const releases = [
      { id: "old", lastSeenAt: "2026-01-01T00:00:00Z", createdAt: "2025-12-01T00:00:00Z" },
      { id: "unseen", lastSeenAt: null, createdAt: "2026-03-01T00:00:00Z" },
      { id: "new", lastSeenAt: "2026-02-01T00:00:00Z", createdAt: "2025-12-02T00:00:00Z" },
    ];
    expect(sortReleasesByLastSeen(releases).map((release) => release.id)).toEqual([
      "new",
      "old",
      "unseen",
    ]);
    expect(releases[0].id).toBe("old");
  });
});

describe("releaseIssuesHref", () => {
  it("opens the issue list filtered by release", () => {
    expect(releaseIssuesHref("acme", "web", "web@1.0.0 beta")).toBe(
      "/orgs/acme/projects/web?tab=observability&release=web%401.0.0+beta&status=all&sortBy=timesSeen",
    );
  });
});
