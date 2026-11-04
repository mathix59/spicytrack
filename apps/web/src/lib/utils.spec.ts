import { afterEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime, getErrorMessage, renderNullableText } from "./utils";

describe("getErrorMessage", () => {
  it("reads the message of a JSON API error body", () => {
    expect(getErrorMessage(new Error('{"message":"Slug taken","statusCode":409}'))).toBe(
      "Slug taken",
    );
  });

  it("joins validation messages", () => {
    expect(getErrorMessage(new Error('{"message":["name is empty","slug is invalid"]}'))).toBe(
      "name is empty slug is invalid",
    );
  });

  it("keeps plain and malformed messages as they are", () => {
    expect(getErrorMessage(new Error("Network down"))).toBe("Network down");
    expect(getErrorMessage(new Error("{not json"))).toBe("{not json");
  });

  it("falls back for values that are not errors", () => {
    expect(getErrorMessage("boom")).toBe("An unknown error occurred");
  });
});

describe("renderNullableText", () => {
  it("uses the fallback for empty or non-string values", () => {
    expect(renderNullableText("Ada", "n/a")).toBe("Ada");
    expect(renderNullableText("", "n/a")).toBe("n/a");
    expect(renderNullableText(null, "n/a")).toBe("n/a");
    expect(renderNullableText(42, "n/a")).toBe("n/a");
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes past and future times in the largest whole unit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));

    expect(formatRelativeTime("2026-11-04T11:59:30Z")).toBe("just now");
    expect(formatRelativeTime("2026-11-04T11:55:00Z")).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-11-04T09:00:00Z")).toBe("3 hours ago");
    expect(formatRelativeTime("2026-11-03T12:00:00Z")).toBe("yesterday");
    expect(formatRelativeTime(new Date("2026-11-18T12:00:00Z"))).toBe("in 2 weeks");
  });
});
