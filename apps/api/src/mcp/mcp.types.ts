export const MCP_SCOPES = [
  "projects:read",
  "issues:read",
  "events:read",
  "releases:read",
  "autofix:read",
  "issues:write",
  "comments:write",
  "autofix:run",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export function isMcpScope(value: unknown): value is McpScope {
  return typeof value === "string" && MCP_SCOPES.includes(value as McpScope);
}
