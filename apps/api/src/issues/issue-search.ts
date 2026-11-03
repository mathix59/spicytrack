import { BadRequestException } from "@nestjs/common";

/**
 * Issue search syntax, close to Sentry's:
 *
 *   TypeError is:unresolved !level:info user.email:*@acme.com browser.name:Chrome age:-24h
 *
 * Bare words and "quoted phrases" match the title or culprit. `key:value` terms filter; a leading
 * `!` (or `-`) negates them. Any key that is not built in matches an event tag.
 */

export type IssueSearchTerm =
  | { kind: "text"; value: string }
  | { kind: "is"; value: IsValue; negated: boolean }
  | { kind: "level" | "priority" | "environment" | "release"; value: string; negated: boolean }
  | { kind: "assigned"; value: "me" | "none" | { email: string }; negated: boolean }
  | { kind: "has"; key: string; negated: boolean }
  | { kind: "tag"; key: string; value: string; negated: boolean }
  | { kind: "age" | "lastSeen"; comparison: "newer" | "older"; since: Date; negated: boolean }
  | { kind: "timesSeen"; operator: ComparisonOperator; count: number; negated: boolean };

const IS_VALUES = ["unresolved", "resolved", "ignored", "regressed", "assigned", "unassigned"];
type IsValue = "unresolved" | "resolved" | "ignored" | "regressed" | "assigned" | "unassigned";
type ComparisonOperator = ">" | ">=" | "<" | "<=" | "=";

const MAX_TERMS = 20;
const MAX_VALUE_LENGTH = 200;
const KEY_ALIASES: Record<string, string> = {
  env: "environment",
  assignee: "assigned",
  "first-seen": "age",
  firstSeen: "age",
  last_seen: "lastSeen",
  times_seen: "timesSeen",
};
const DURATION_UNITS_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

// `!key:"quoted value"`, `key:value`, `"quoted text"` or a bare word.
const TOKEN = /([!-]?)([A-Za-z_][\w.-]*):(?:"([^"]*)"|(\S+))|"([^"]*)"|(\S+)/g;

function invalid(message: string): never {
  throw new BadRequestException(`Invalid search: ${message}`);
}

function parseDuration(key: string, raw: string, now: Date) {
  const match = /^([+-])(\d+)([mhdw])$/.exec(raw);
  if (!match) invalid(`${key} expects -24h (within) or +7d (older than); units m, h, d, w`);
  const [, sign, amount, unit] = match;
  return {
    comparison: sign === "-" ? ("newer" as const) : ("older" as const),
    since: new Date(now.getTime() - Number(amount) * DURATION_UNITS_MS[unit]),
  };
}

function parseCount(raw: string) {
  const match = /^(>=|<=|>|<|=)?(\d{1,9})$/.exec(raw);
  if (!match) invalid("timesSeen expects a number, optionally prefixed by >, >=, < or <=");
  return { operator: (match[1] ?? "=") as ComparisonOperator, count: Number(match[2]) };
}

function parseTerm(rawKey: string, value: string, negated: boolean, now: Date): IssueSearchTerm {
  const key = KEY_ALIASES[rawKey] ?? rawKey;
  if (value.length === 0) invalid(`${rawKey} needs a value`);
  if (value.length > MAX_VALUE_LENGTH) invalid(`${rawKey} value is too long`);

  switch (key) {
    case "is": {
      const normalized = value.toLowerCase() === "open" ? "unresolved" : value.toLowerCase();
      if (!IS_VALUES.includes(normalized)) invalid(`is: accepts ${IS_VALUES.join(", ")}`);
      return { kind: "is", value: normalized as IsValue, negated };
    }
    case "level":
    case "priority":
      return { kind: key, value: value.toLowerCase(), negated };
    case "environment":
    case "release":
      return { kind: key, value, negated };
    case "assigned": {
      const lower = value.toLowerCase();
      if (lower === "me" || lower === "none") return { kind: "assigned", value: lower, negated };
      if (!lower.includes("@")) invalid("assigned: accepts me, none or an email address");
      return { kind: "assigned", value: { email: lower }, negated };
    }
    case "has":
      return { kind: "has", key: value, negated };
    case "age":
    case "lastSeen":
      return { kind: key, ...parseDuration(rawKey, value, now), negated };
    case "timesSeen":
      return { kind: "timesSeen", ...parseCount(value), negated };
    default:
      return { kind: "tag", key: rawKey, value, negated };
  }
}

export function parseIssueSearch(query: string, now = new Date()): IssueSearchTerm[] {
  const terms: IssueSearchTerm[] = [];

  for (const match of query.matchAll(TOKEN)) {
    const [token, negation, key, quotedValue, value, quotedText, word] = match;
    // A pasted URL is text, not an `http:` filter.
    if (key !== undefined && !/^https?$/i.test(key)) {
      terms.push(parseTerm(key, (quotedValue ?? value).trim(), negation !== "", now));
    } else {
      const text = (quotedText ?? word ?? token).trim();
      if (text) terms.push({ kind: "text", value: text.slice(0, MAX_VALUE_LENGTH) });
    }
    if (terms.length > MAX_TERMS) invalid(`at most ${MAX_TERMS} terms`);
  }

  return terms;
}
