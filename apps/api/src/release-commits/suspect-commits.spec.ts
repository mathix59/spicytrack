import type { ReleaseCommitFile } from "../database/schema";
import {
  commitShaFromVersion,
  pathSegments,
  pathsMatch,
  rankSuspectCommits,
  type SuspectFrame,
} from "./suspect-commits";

const frame = (path: string, inApp: boolean | null = null, fn = "handler"): SuspectFrame => ({
  path,
  function: fn,
  lineno: 10,
  inApp,
});

const commit = (sha: string, paths: string[], committedAt = "2026-11-01T00:00:00Z") => ({
  sha,
  committedAt: new Date(committedAt),
  files: paths.map((path): ReleaseCommitFile => ({ path, status: "modified" })),
});

describe("pathSegments", () => {
  it.each([
    ["webpack://app/./src/checkout.ts", ["src", "checkout.ts"]],
    ["webpack:///src/checkout.ts", ["src", "checkout.ts"]],
    ["https://cdn.example.com/assets/main.js?v=3", ["assets", "main.js"]],
    ["app:///dist/server.js", ["dist", "server.js"]],
    ["C:\\repo\\src\\a.ts", ["C:", "repo", "src", "a.ts"]],
    ["../../src/cart.tsx", ["src", "cart.tsx"]],
  ])("normalizes %s", (input, expected) => {
    expect(pathSegments(input)).toEqual(expected);
  });
});

describe("pathsMatch", () => {
  it("matches when either path ends with the whole other one", () => {
    expect(pathsMatch(["src", "a.ts"], ["apps", "web", "src", "a.ts"])).toBe(true);
    expect(pathsMatch(["home", "ci", "repo", "apps", "api", "b.ts"], ["apps", "api", "b.ts"])).toBe(
      true,
    );
  });

  it("does not match a bare file name against a deeper path", () => {
    expect(pathsMatch(["index.ts"], ["src", "index.ts"])).toBe(false);
    expect(pathsMatch(["index.ts"], ["index.ts"])).toBe(true);
  });

  it("does not match different directories", () => {
    expect(pathsMatch(["web", "src", "a.ts"], ["api", "src", "a.ts"])).toBe(false);
  });
});

describe("rankSuspectCommits", () => {
  // Oldest call first, as in the payload: checkout.ts raised the error.
  const frames = [
    frame("/app/node_modules/express/lib/router.js", false),
    frame("/srv/app/apps/api/src/orders/orders.service.ts", true, "createOrder"),
    frame("/srv/app/apps/api/src/payments/checkout.ts", true, "charge"),
  ];

  it("ranks the commit touching the raising frame first", () => {
    const suspects = rankSuspectCommits(frames, [
      commit("caller", ["apps/api/src/orders/orders.service.ts"]),
      commit("raiser", ["apps/api/src/payments/checkout.ts", "README.md"]),
      commit("unrelated", ["apps/web/src/main.tsx"]),
    ]);

    expect(suspects.map((suspect) => suspect.commit.sha)).toEqual(["raiser", "caller"]);
    expect(suspects[0]).toMatchObject({
      score: 1,
      matches: [{ path: "apps/api/src/payments/checkout.ts", function: "charge", depth: 0 }],
    });
    expect(suspects[1].score).toBe(0.5);
  });

  it("adds up every matched frame of one commit", () => {
    const [suspect] = rankSuspectCommits(frames, [
      commit("both", [
        "apps/api/src/payments/checkout.ts",
        "apps/api/src/orders/orders.service.ts",
      ]),
    ]);
    expect(suspect.score).toBe(1.5);
    expect(suspect.matches.map((match) => match.depth)).toEqual([0, 1]);
  });

  it("ignores dependencies, non in-app frames and removed files", () => {
    const suspects = rankSuspectCommits(frames, [
      commit("deps", ["node_modules/express/lib/router.js"]),
      {
        sha: "removed",
        committedAt: null,
        files: [{ path: "apps/api/src/payments/checkout.ts", status: "removed" as const }],
      },
    ]);
    expect(suspects).toEqual([]);
  });

  it("uses every frame when the SDK sends no in-app flags", () => {
    const suspects = rankSuspectCommits(
      [frame("src/a.ts"), frame("src/b.ts")],
      [commit("a", ["web/src/a.ts"])],
    );
    expect(suspects[0].matches[0].depth).toBe(1);
  });

  it("breaks ties with the newest commit and keeps three suspects", () => {
    const suspects = rankSuspectCommits(
      [frame("src/a.ts", true)],
      ["2026-11-01", "2026-11-04", "2026-11-03", "2026-11-02"].map((date) =>
        commit(date, ["src/a.ts"], `${date}T00:00:00Z`),
      ),
    );
    expect(suspects.map((suspect) => suspect.commit.sha)).toEqual([
      "2026-11-04",
      "2026-11-03",
      "2026-11-02",
    ]);
  });
});

describe("commitShaFromVersion", () => {
  it("treats only a full SHA as a commit", () => {
    expect(commitShaFromVersion("A".repeat(40))).toBe("a".repeat(40));
    expect(commitShaFromVersion("1.2.3")).toBeNull();
    expect(commitShaFromVersion("abc1234")).toBeNull();
  });
});
