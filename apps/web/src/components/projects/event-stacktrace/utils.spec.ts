import { describe, expect, it } from "vitest";

import type { ResolvedFrameDto } from "@/generated/api";

import { extractExceptions, languageForFilename, splitPath } from "./utils";

const frame = (filename: string, lineno: number, extra: Record<string, unknown> = {}) => ({
  filename,
  function: `fn${lineno}`,
  lineno,
  ...extra,
});

const resolvedFrame = (overrides: Partial<ResolvedFrameDto>): ResolvedFrameDto => ({
  filename: "src/app.ts",
  lineno: 1,
  resolved: true,
  resolution: "sourcemap",
  diagnostic: "",
  ...overrides,
});

describe("extractExceptions", () => {
  it("puts the thrown exception first and the most recent call first", () => {
    const exceptions = extractExceptions({
      exception: {
        values: [
          { type: "CauseError", value: "cause", stacktrace: { frames: [frame("a.js", 1)] } },
          {
            type: "TypeError",
            value: "x is undefined",
            mechanism: { type: "onerror", handled: false },
            stacktrace: { frames: [frame("b.js", 10), frame("c.js", 20)] },
          },
        ],
      },
    });

    expect(exceptions.map((exception) => exception.type)).toEqual(["TypeError", "CauseError"]);
    expect(exceptions[0].frames.map((item) => item.filename)).toEqual(["c.js", "b.js"]);
    expect(exceptions[0]).toMatchObject({ handled: false, mechanism: "onerror" });
  });

  it("uses thread stacks when exceptions carry no frames", () => {
    const exceptions = extractExceptions({
      exception: [{ type: "Panic", value: "boom" }],
      threads: { values: [{ stacktrace: { frames: [frame("main.go", 7)] } }] },
    });

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].type).toBe("Panic");
    expect(exceptions[0].frames[0]).toMatchObject({ filename: "main.go", lineno: 7 });
  });

  it("shows thread stacks of a message event without an exception", () => {
    const exceptions = extractExceptions({
      threads: [{ stacktrace: { frames: [frame("worker.py", 3)] } }],
    });

    expect(exceptions).toEqual([expect.objectContaining({ type: null, value: null })]);
    expect(exceptions[0].frames[0].filename).toBe("worker.py");
  });

  it("matches resolved frames by their offset across every exception", () => {
    const exceptions = extractExceptions(
      {
        exception: {
          values: [
            { type: "Cause", stacktrace: { frames: [frame("bundle.js", 1)] } },
            { type: "Thrown", stacktrace: { frames: [frame("bundle.js", 2)] } },
          ],
        },
      },
      [
        resolvedFrame({ filename: "src/cause.ts", lineno: 11 }),
        resolvedFrame({ filename: "src/thrown.ts", lineno: 22, contextLine: "throw error;" }),
      ],
    );

    expect(exceptions[0].frames[0]).toMatchObject({
      filename: "src/thrown.ts",
      lineno: 22,
      contextLine: "throw error;",
      resolution: "sourcemap",
    });
    expect(exceptions[1].frames[0].filename).toBe("src/cause.ts");
  });

  it("ignores resolved frames that do not line up with the payload", () => {
    const exceptions = extractExceptions(
      { exception: { values: [{ stacktrace: { frames: [frame("bundle.js", 1)] } }] } },
      [resolvedFrame({}), resolvedFrame({})],
    );

    expect(exceptions[0].frames[0]).toMatchObject({ filename: "bundle.js", resolved: null });
  });

  it("keeps the raw frame when resolution failed, with its diagnostic", () => {
    const exceptions = extractExceptions(
      { exception: { values: [{ stacktrace: { frames: [frame("bundle.js", 9)] } }] } },
      [resolvedFrame({ resolved: false, diagnostic: "missing source map" })],
    );

    expect(exceptions[0].frames[0]).toMatchObject({
      filename: "bundle.js",
      lineno: 9,
      resolved: false,
      diagnostic: "missing source map",
    });
  });

  it("marks library frames as outside the app", () => {
    const [exception] = extractExceptions({
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                frame("/app/node_modules/react/index.js", 1),
                frame("C:\\app\\node_modules\\lib.js", 2),
                frame("/app/src/vendor.js", 3, { in_app: false }),
                frame("/app/src/main.js", 4),
              ],
            },
          },
        ],
      },
    });

    expect(exception.frames.map((item) => item.inApp)).toEqual([true, false, false, false]);
  });
});

describe("languageForFilename", () => {
  it("maps extensions, ignoring query strings and case", () => {
    expect(languageForFilename("https://cdn.example.com/app.MJS?v=3")).toBe("javascript");
    expect(languageForFilename("src/App.tsx")).toBe("tsx");
    expect(languageForFilename("Main.java")).toBe("clike");
    expect(languageForFilename("Makefile")).toBe("plain");
  });
});

describe("splitPath", () => {
  it("splits on the last slash of either kind", () => {
    expect(splitPath("/app/src/main.ts")).toEqual({ directory: "/app/src/", basename: "main.ts" });
    expect(splitPath("C:\\app\\main.cs")).toEqual({ directory: "C:\\app\\", basename: "main.cs" });
    expect(splitPath("main.go")).toEqual({ directory: "", basename: "main.go" });
  });
});
