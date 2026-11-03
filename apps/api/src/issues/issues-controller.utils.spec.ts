import { BadRequestException } from "@nestjs/common";

import {
  MAX_ISSUE_TREND_IDS,
  parseBulkIssueStatusBody,
  parseCreateCommentBody,
  parseIssueStatusBody,
  parseIssueTrendsQuery,
  parseMergeIssueBody,
} from "./issues-controller.utils";

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

describe("issue status bodies", () => {
  it("only accepts open, resolved and ignored", () => {
    expect(parseIssueStatusBody({ status: "resolved" }).status).toBe("resolved");
    expect(() => parseIssueStatusBody({ status: "merged" })).toThrow(BadRequestException);
    expect(() => parseBulkIssueStatusBody({ issueIds: [issueId(1)], status: "bogus" })).toThrow(
      BadRequestException,
    );
  });

  it("rejects an ignore that would already be over", () => {
    expect(() =>
      parseIssueStatusBody({ status: "ignored", ignoredUntil: "2000-01-01T00:00:00Z" }),
    ).toThrow("ignoredUntil must be in the future");
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(parseIssueStatusBody({ status: "ignored", ignoredUntil: future }).ignoredUntil).toEqual(
      new Date(future),
    );
  });

  it("bounds bulk requests to deduplicated issue UUIDs", () => {
    expect(
      parseBulkIssueStatusBody({ issueIds: [issueId(1), issueId(1)], status: "open" }).issueIds,
    ).toEqual([issueId(1)]);
    expect(() => parseBulkIssueStatusBody({ issueIds: ["nope"], status: "open" })).toThrow(
      "issueIds must contain issue IDs",
    );
    expect(() =>
      parseBulkIssueStatusBody({
        issueIds: Array.from({ length: 501 }, (_, index) => issueId(index)),
        status: "open",
      }),
    ).toThrow("issueIds accepts at most 500 issues");
  });
});

describe("issue comment and merge bodies", () => {
  it("trims comments and bounds their length", () => {
    expect(parseCreateCommentBody({ body: "  looks fixed  " })).toEqual({ body: "looks fixed" });
    expect(() => parseCreateCommentBody({ body: "   " })).toThrow("body is required");
    expect(() => parseCreateCommentBody({ body: "x".repeat(10_001) })).toThrow(
      "body must be at most 10000 characters",
    );
  });

  it("requires a merge target that is an issue ID", () => {
    expect(parseMergeIssueBody({ targetIssueId: issueId(3) })).toEqual({
      targetIssueId: issueId(3),
    });
    expect(() => parseMergeIssueBody({ targetIssueId: "PROJ-12" })).toThrow(
      "targetIssueId must be an issue ID",
    );
  });
});
