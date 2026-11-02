import { BadRequestException } from "@nestjs/common";

import { MAX_ISSUE_TREND_IDS, parseIssueTrendsQuery } from "./issues-controller.utils";

const issueId = (index: number) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;

describe("parseIssueTrendsQuery", () => {
  it("parses, trims, lowercases and de-duplicates issue ids", () => {
    const upper = issueId(1).toUpperCase();

    expect(
      parseIssueTrendsQuery({ issueIds: ` ${upper}, ${issueId(2)},,${issueId(1)}`, period: "14d" }),
    ).toEqual({ issueIds: [issueId(1), issueId(2)], period: "14d" });
  });

  it("defaults period to 24h", () => {
    expect(parseIssueTrendsQuery({ issueIds: issueId(1) }).period).toBe("24h");
  });

  it("rejects missing or empty issue ids", () => {
    expect(() => parseIssueTrendsQuery({})).toThrow(BadRequestException);
    expect(() => parseIssueTrendsQuery({ issueIds: " , " })).toThrow(BadRequestException);
  });

  it("rejects non-UUID issue ids", () => {
    expect(() => parseIssueTrendsQuery({ issueIds: `${issueId(1)},nope` })).toThrow(
      "issueIds must be a comma-separated list of UUIDs",
    );
  });

  it(`rejects more than ${MAX_ISSUE_TREND_IDS} issue ids`, () => {
    const ids = Array.from({ length: MAX_ISSUE_TREND_IDS }, (_, index) => issueId(index));

    expect(parseIssueTrendsQuery({ issueIds: ids.join(",") }).issueIds).toHaveLength(
      MAX_ISSUE_TREND_IDS,
    );
    expect(() =>
      parseIssueTrendsQuery({ issueIds: [...ids, issueId(MAX_ISSUE_TREND_IDS)].join(",") }),
    ).toThrow(`issueIds must contain at most ${MAX_ISSUE_TREND_IDS} issue ids`);
  });

  it("rejects unknown periods", () => {
    expect(() => parseIssueTrendsQuery({ issueIds: issueId(1), period: "7d" })).toThrow(
      "period must be 24h or 14d",
    );
  });
});
