import { computeIssueTitle, getAllFrames, getFrameKey } from "./grouping";

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
