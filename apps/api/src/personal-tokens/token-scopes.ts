/**
 * Personal access token scopes. They narrow what the token's owner may do, never widen it:
 * - read: every GET, and permissions ending in `.read`;
 * - write: also project changes (issues, releases, alerts, keys, integrations, autofix);
 * - admin: also organization administration (members, teams, projects, settings).
 * Each scope includes the ones before it.
 */
export const TOKEN_SCOPES = ["read", "write", "admin"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export const DEFAULT_TOKEN_EXPIRY_DAYS = 90;
export const MAX_TOKEN_EXPIRY_DAYS = 365;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function rank(scope: TokenScope) {
  return TOKEN_SCOPES.indexOf(scope);
}

/** The highest scope granted; scopes are cumulative. */
export function tokenLevel(scopes: readonly string[]): TokenScope | null {
  let level: TokenScope | null = null;
  for (const scope of scopes) {
    if ((TOKEN_SCOPES as readonly string[]).includes(scope)) {
      if (level === null || rank(scope as TokenScope) > rank(level)) level = scope as TokenScope;
    }
  }
  return level;
}

export function scopeForPermission(permission: string): TokenScope {
  if (permission.endsWith(".read")) return "read";
  if (permission.startsWith("project.")) return "write";
  return "admin";
}

export function tokenAllows(scopes: readonly string[], needed: TokenScope) {
  const level = tokenLevel(scopes);
  return level !== null && rank(level) >= rank(needed);
}

/** Read-only tokens may not change anything, even on routes without a permission. */
export function tokenAllowsMethod(scopes: readonly string[], method: string) {
  return SAFE_METHODS.has(method.toUpperCase()) || tokenAllows(scopes, "write");
}
