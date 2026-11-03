import {
  computeGroupingKey,
  computeGroupingKeys,
  computeIssueTitle,
  getAllFrames,
  getFrameKey,
  normalizeVariableText,
} from "./grouping";

describe("grouping protocol compatibility", () => {
  const frame = {
    abs_path: "/fixture/main.go",
    module: "main",
    function: "main",
    lineno: 23,
  };

  it("reads SDKs that encode exception as a direct array", () => {
    const payload = {
      exception: [
        {
          type: "ProbeError",
          value: "checkout failed",
          stacktrace: { frames: [frame] },
        },
      ],
    };

    expect(computeIssueTitle(payload)).toBe("ProbeError: checkout failed");
    expect(getAllFrames(payload)).toEqual([
      {
        filename: null,
        absPath: "/fixture/main.go",
        module: "main",
        package: null,
        function: "main",
        lineno: 23,
        colno: null,
        inApp: null,
      },
    ]);
    expect(getFrameKey(payload)).toBe("/fixture/main.go:main:23");
  });

  it("falls back to thread stacktraces when an event has no exception frames", () => {
    const payload = { threads: { values: [{ stacktrace: { frames: [frame] } }] } };

    expect(getAllFrames(payload)).toHaveLength(1);
    expect(getFrameKey(payload)).toBe("/fixture/main.go:main:23");
  });
});

describe("grouping v2", () => {
  const exceptionWith = (value: string, frames: Record<string, unknown>[]) => ({
    exception: { values: [{ type: "TypeError", value, stacktrace: { frames } }] },
  });

  it("ignores line numbers, bundle hashes and deploy paths", () => {
    const before = exceptionWith("boom", [
      {
        filename: "https://cdn.example.com/assets/index-D6Sueoy0.js?v=1",
        function: "loadCart",
        lineno: 10,
        colno: 4,
      },
    ]);
    const after = exceptionWith("boom", [
      {
        filename: "https://cdn.example.com/assets/index-Bq7x2LmA.js",
        function: "loadCart",
        lineno: 97,
        colno: 12,
      },
    ]);
    const serverA = exceptionWith("boom", [
      { abs_path: "/srv/releases/41/src/cart.js", function: "loadCart" },
    ]);
    const serverB = exceptionWith("boom", [
      { abs_path: "/srv/releases/42/src/cart.js", function: "loadCart" },
    ]);

    expect(computeGroupingKey(before)).toBe(computeGroupingKey(after));
    expect(computeGroupingKey(before)).toBe("v2|TypeError|boom|assets/index.js:loadCart");
    expect(computeGroupingKey(serverA)).toBe(computeGroupingKey(serverB));
  });

  it("replaces variable data in messages but keeps short codes", () => {
    const key = (message: string) => computeGroupingKey({ message });

    expect(key("User 4f1c2b9e-1d2a-4c3b-9e8f-0a1b2c3d4e5f not found")).toBe(
      key("User 0b9c8d7e-6f5a-4b3c-8d2e-1f0a9b8c7d6e not found"),
    );
    expect(key("Order 123456 failed for ops@example.com at 2026-11-03T10:00:00Z")).toBe(
      key("Order 987654 failed for dev@example.org at 2026-11-04T08:30:12Z"),
    );
    expect(key("GET https://api.example.com/v1/orders/1 failed")).toBe(
      key("GET https://api.example.com/v1/orders/2 failed"),
    );
    expect(key("Request failed with status 404")).not.toBe(key("Request failed with status 500"));
    expect(normalizeVariableText("Cannot read properties of undefined (reading 'id')")).toBe(
      "Cannot read properties of undefined (reading 'id')",
    );
  });

  it("locates the crash in the innermost application frame", () => {
    const frames = [
      { filename: "src/app.js", function: "main", in_app: true },
      { filename: "src/cart.js", function: "addItem", in_app: true },
      { filename: "node_modules/lodash/lodash.js", function: "baseGet", in_app: false },
    ];
    const withoutFlags = frames.map(({ in_app: _inApp, ...frame }) => frame);

    expect(computeGroupingKey(exceptionWith("boom", frames))).toMatch(/\|src\/cart\.js:addItem$/);
    expect(computeGroupingKey(exceptionWith("boom", withoutFlags))).toMatch(
      /\|src\/cart\.js:addItem$/,
    );
  });

  it("drops minified function names that change with every build", () => {
    const first = exceptionWith("boom", [{ filename: "app.js", function: "t" }]);
    const second = exceptionWith("boom", [{ filename: "app.js", function: "Xo" }]);

    expect(computeGroupingKey(first)).toBe(computeGroupingKey(second));
  });

  it("expands {{ default }} in SDK fingerprints", () => {
    const payload = { ...exceptionWith("boom", []), fingerprint: ["{{ default }}", "tenant-a"] };

    expect(computeGroupingKey(payload)).toBe(
      `fingerprint:${computeGroupingKey(exceptionWith("boom", []))}|tenant-a`,
    );
    expect(computeGroupingKey({ fingerprint: ["checkout", 42] })).toBe("fingerprint:checkout|42");
  });

  it("reports the legacy key only when it differs", () => {
    const payload = exceptionWith("boom", [{ filename: "app.js", function: "main", lineno: 3 }]);

    expect(computeGroupingKeys(payload)).toEqual({
      groupingKey: "v2|TypeError|boom|app.js:main",
      legacyGroupingKey: "TypeError|boom|app.js:main:3",
    });
  });
});
