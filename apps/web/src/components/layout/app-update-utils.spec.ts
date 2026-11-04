import { describe, expect, it } from "vitest";

import { isVersionNewer } from "./app-update-utils";

describe("isVersionNewer", () => {
  it("compares numeric parts, not strings", () => {
    expect(isVersionNewer("1.10.0", "1.9.9")).toBe(true);
    expect(isVersionNewer("v2.0.0", "1.99.99")).toBe(true);
    expect(isVersionNewer("1.2.3", "1.2.3")).toBe(false);
    expect(isVersionNewer("1.2.2", "1.2.3")).toBe(false);
  });

  it("treats a release as newer than its prerelease, never the reverse", () => {
    expect(isVersionNewer("1.2.0", "1.2.0-rc.1")).toBe(true);
    expect(isVersionNewer("1.2.0-rc.1", "1.2.0")).toBe(false);
  });

  it("ignores versions it cannot parse", () => {
    expect(isVersionNewer("latest", "1.0.0")).toBe(false);
    expect(isVersionNewer("2.0.0", "dev")).toBe(false);
  });
});
