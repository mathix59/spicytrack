import { describe, expect, it } from "vitest";

import type { ResolvedFrameDto } from "@/generated/api";

import type { EventException, StackFrame } from "./types";
import {
  extractExceptions,
  formatStackTrace,
  isLibraryFrame,
  languageForFilename,
  splitPath,
} from "./utils";

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
    expect(exceptions[0].resolutionSkipped).toBe(true);
  });

  it("does not flag skipped resolution when frames line up or none were resolved", () => {
    const payload = {
      exception: { values: [{ stacktrace: { frames: [frame("bundle.js", 1)] } }] },
    };

    expect(extractExceptions(payload, [resolvedFrame({})])[0].resolutionSkipped).toBe(false);
    expect(extractExceptions(payload, [])[0].resolutionSkipped).toBe(false);
    expect(extractExceptions(payload)[0].resolutionSkipped).toBe(false);
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

  it("lets an explicit in_app override the library path heuristic", () => {
    const [exception] = extractExceptions({
      exception: {
        values: [
          {
            stacktrace: {
              frames: [
                frame("/app/node_modules/@acme/shared/index.js", 1, { in_app: true }),
                frame("/usr/lib/python3.12/site-packages/django/core.py", 2),
                frame("Thread.java", 3, { module: "java.lang.Thread" }),
              ],
            },
          },
        ],
      },
    });

    expect(exception.frames.map((item) => item.inApp)).toEqual([false, false, true]);
  });
});

describe("isLibraryFrame", () => {
  it.each([
    "/app/node_modules/react/index.js",
    "/srv/venv/lib/python3.12/site-packages/django/core/handlers.py",
    "/usr/lib/python3/dist-packages/requests/api.py",
    "/usr/lib/python3.11/asyncio/base_events.py",
    "/usr/local/lib/python3.12/threading.py",
    "/app/vendor/laravel/framework/src/Router.php",
    "/home/ci/go/pkg/mod/github.com/gin-gonic/gin@v1.9.1/context.go",
    "/home/ci/.cargo/registry/src/index.crates.io-6f17d22bba15001f/tokio-1.37.0/src/lib.rs",
    "/rustc/9b00956e56009bab2aa15d7bff10916599e3d6d6/library/core/src/panicking.rs",
    "/usr/local/bundle/gems/rack-3.0.8/lib/rack/builder.rb",
    "webpack-internal:///(webpack)/buildin/module.js",
    "chrome-extension://abcdefghijklmnop/content.js",
    "moz-extension://4b3e1f2a/content.js",
  ])("treats %s as library code", (path) => {
    expect(isLibraryFrame([path], null)).toBe(true);
  });

  it.each(["java.lang.Thread", "javax.servlet.http.HttpServlet", "kotlin.coroutines.Continuation"])(
    "treats the %s module as library code",
    (module) => {
      expect(isLibraryFrame(["Thread.java"], module)).toBe(true);
    },
  );

  it.each([
    ["/app/src/main.ts", null],
    ["/app/src/vendor.js", null],
    ["webpack-internal:///./src/app.tsx", null],
    ["/usr/src/app/handlers.py", null],
    ["Checkout.kt", "com.acme.checkout.Checkout"],
  ])("keeps %s as application code", (path, module) => {
    expect(isLibraryFrame([path], module)).toBe(false);
  });
});

describe("formatStackTrace", () => {
  const stackFrame = (overrides: Partial<StackFrame>): StackFrame => ({
    filename: "src/app.ts",
    function: null,
    lineno: 1,
    colno: null,
    inApp: true,
    preContext: [],
    contextLine: null,
    postContext: [],
    resolved: null,
    resolution: null,
    diagnostic: null,
    ...overrides,
  });
  const exception = (overrides: Partial<EventException>): EventException => ({
    type: null,
    value: null,
    module: null,
    handled: null,
    mechanism: null,
    frames: [],
    resolutionSkipped: false,
    ...overrides,
  });

  it("lists the thrown exception, then its causes, most recent call first", () => {
    const text = formatStackTrace([
      exception({
        type: "TypeError",
        value: "x is undefined",
        frames: [
          stackFrame({ function: "render", filename: "src/view.ts", lineno: 12, colno: 4 }),
          stackFrame({ filename: "src/main.ts", lineno: 3 }),
        ],
      }),
      exception({
        type: "FetchError",
        value: "timeout",
        frames: [stackFrame({ function: "load", filename: "src/api.ts", lineno: 7, colno: 9 })],
      }),
      exception({ frames: [] }),
    ]);

    expect(text).toBe(
      [
        "TypeError: x is undefined",
        "  at render (src/view.ts:12:4)",
        "  at <anonymous> (src/main.ts:3)",
        "Caused by: FetchError: timeout",
        "  at load (src/api.ts:7:9)",
        "Caused by: Error",
      ].join("\n"),
    );
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
