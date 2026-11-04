import { describe, expect, it } from "vitest";

import { describeUserAgent } from "./describe-user-agent";

describe("describeUserAgent", () => {
  it("names the browser and system", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      ),
    ).toEqual({ label: "Edge on Windows", mobile: false });
    expect(
      describeUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
      ),
    ).toEqual({ label: "Safari on macOS", mobile: false });
  });

  it("flags mobile devices, checking iOS before macOS", () => {
    expect(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      ),
    ).toEqual({ label: "Safari on iOS", mobile: true });
  });

  it("falls back to whatever part it recognizes", () => {
    expect(describeUserAgent("curl/8.9.1")).toEqual({ label: "Unknown device", mobile: false });
    expect(describeUserAgent("SomeBot (Linux)")).toEqual({ label: "Linux", mobile: false });
    expect(describeUserAgent(null)).toEqual({ label: "Unknown device", mobile: false });
  });
});
