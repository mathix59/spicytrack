import { resolveEventStack } from "./resolved-stack";

describe("resolveEventStack", () => {
  const payload = {
    exception: {
      values: [
        {
          type: "TypeError",
          value: "x is undefined",
          stacktrace: {
            frames: [
              {
                filename: "node_modules/react-dom.js",
                function: "invoke",
                lineno: 1,
                in_app: false,
              },
              { filename: "app.min.js", function: "a", lineno: 1, colno: 9041, in_app: true },
              {
                filename: "src/form.ts",
                function: "submit",
                lineno: 12,
                in_app: true,
                context_line: "  submit(token=abc);",
              },
            ],
          },
        },
      ],
    },
  };
  const resolver = {
    resolveFrames: jest.fn(async () => [
      { filename: "node_modules/react-dom.js", lineno: 1, resolved: true, resolution: "original" },
      {
        filename: "src/checkout/pay.ts",
        function: "chargeCard",
        lineno: 88,
        colno: 5,
        contextLine: "    card.charge();",
        resolved: true,
        resolution: "sourcemap",
      },
      { filename: "src/form.ts", lineno: 12, resolved: true, resolution: "original" },
    ]),
  };
  const event = {
    rawPayload: payload,
    releaseId: "r1",
    sdkName: "sentry.javascript.browser",
    platform: "javascript",
  };

  it("returns redacted in-app frames newest first with source-mapped locations", async () => {
    const stack = await resolveEventStack(resolver as never, event, { maxFrames: 10 });
    expect(stack).toEqual({
      header: "TypeError: x is undefined",
      totalFrames: 3,
      frames: [
        {
          function: "submit",
          path: "src/form.ts",
          lineno: 12,
          colno: null,
          inApp: true,
          mapped: false,
          // The payload is redacted before frames are read.
          contextLine: "  submit(token=[Filtered]",
        },
        {
          function: "chargeCard",
          path: "src/checkout/pay.ts",
          lineno: 88,
          colno: 5,
          inApp: true,
          mapped: true,
          contextLine: "    card.charge();",
        },
      ],
    });
    expect(resolver.resolveFrames).toHaveBeenCalledWith(
      expect.objectContaining({ releaseId: "r1", platform: "javascript" }),
    );
  });

  it("keeps library frames when asked and caps the frame count", async () => {
    const all = await resolveEventStack(resolver as never, event, {
      maxFrames: 10,
      allFrames: true,
    });
    expect(all.frames.map((frame) => frame.function)).toEqual(["submit", "chargeCard", "invoke"]);
    const capped = await resolveEventStack(resolver as never, event, { maxFrames: 1 });
    expect(capped.frames).toHaveLength(1);
  });
});
