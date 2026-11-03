import { BadRequestException } from "@nestjs/common";

import { parseIssueSearch } from "./issue-search";

const now = new Date("2026-11-03T12:00:00Z");

describe("parseIssueSearch", () => {
  it("returns no terms for an empty query", () => {
    expect(parseIssueSearch("", now)).toEqual([]);
  });

  it("keeps words, quoted phrases and pasted URLs as text", () => {
    expect(parseIssueSearch('TypeError: "Cannot read" https://app.example.com/a', now)).toEqual([
      { kind: "text", value: "TypeError:" },
      { kind: "text", value: "Cannot read" },
      { kind: "text", value: "https://app.example.com/a" },
    ]);
  });

  it("parses built-in filters and negation", () => {
    expect(parseIssueSearch("is:open !level:info env:production assigned:me", now)).toEqual([
      { kind: "is", value: "unresolved", negated: false },
      { kind: "level", value: "info", negated: true },
      { kind: "environment", value: "production", negated: false },
      { kind: "assigned", value: "me", negated: false },
    ]);
    expect(parseIssueSearch("assigned:Ada@Example.com -is:regressed", now)).toEqual([
      { kind: "assigned", value: { email: "ada@example.com" }, negated: false },
      { kind: "is", value: "regressed", negated: true },
    ]);
  });

  it("treats unknown keys as tags, including quoted values", () => {
    expect(
      parseIssueSearch('user.email:*@acme.com browser.name:"Mobile Safari" has:os', now),
    ).toEqual([
      { kind: "tag", key: "user.email", value: "*@acme.com", negated: false },
      { kind: "tag", key: "browser.name", value: "Mobile Safari", negated: false },
      { kind: "has", key: "os", negated: false },
    ]);
  });

  it("parses relative dates and counts", () => {
    expect(parseIssueSearch("age:-24h lastSeen:+7d timesSeen:>=100", now)).toEqual([
      {
        kind: "age",
        comparison: "newer",
        since: new Date("2026-11-02T12:00:00Z"),
        negated: false,
      },
      {
        kind: "lastSeen",
        comparison: "older",
        since: new Date("2026-10-27T12:00:00Z"),
        negated: false,
      },
      { kind: "timesSeen", operator: ">=", count: 100, negated: false },
    ]);
  });

  it("rejects invalid filters with a readable message", () => {
    for (const query of ["is:sleeping", "age:yesterday", "timesSeen:many", "assigned:bob"]) {
      expect(() => parseIssueSearch(query, now)).toThrow(BadRequestException);
    }
    expect(() => parseIssueSearch("is:sleeping", now)).toThrow(/Invalid search: is: accepts/);
    expect(() => parseIssueSearch(Array.from({ length: 21 }, () => "a").join(" "), now)).toThrow(
      /at most 20 terms/,
    );
  });
});
