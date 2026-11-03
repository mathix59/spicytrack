import { orvalFetch } from "@/lib/orval-fetch";

const MCP_SCOPES = [
  ["projects:read", "Projects"],
  ["issues:read", "Issues"],
  ["events:read", "Events (redacted)"],
  ["releases:read", "Releases"],
  ["autofix:read", "Autofix runs"],
  ["issues:write", "Update issues"],
  ["comments:write", "Create comments"],
  ["autofix:run", "Run Autofix"],
] as const;

/** The first scopes are read-only and selected by default for new keys. */
const DEFAULT_SCOPE_COUNT = 4;

type McpCredential = {
  id: string;
  name: string;
  tokenPreview: string;
  scopes: string[];
  allProjects: boolean;
  projectIds: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type McpActivity = {
  id: string;
  action: string;
  payload: {
    tool?: string;
    status?: string;
    /** Tool arguments as audited: long text truncated, comment bodies reduced to a length. */
    arguments?: Record<string, unknown>;
    error?: string;
  };
  createdAt: string;
  credentialName: string | null;
};

type McpData = {
  endpoint: string;
  enabled: boolean;
  credentials: McpCredential[];
  activity: McpActivity[];
};

type McpKeyResponse = { credential: McpCredential; secret: string };

type McpVerification = {
  ready: boolean;
  checks: { serverEnabled: boolean; credentialActive: boolean; projectsAccessible: number };
};

async function mcpRequest<T>(
  orgSlug: string,
  path: string,
  options: { method: string; body?: Record<string, unknown> | BodyInit | null },
) {
  return orvalFetch<{ data: T }>(`/organizations/${orgSlug}/mcp${path}`, options as never).then(
    (response) => response.data,
  );
}

function buildClientConfig(endpoint: string, secret: string | null) {
  return `{"mcpServers":{"SpicyTrack":{"url":"${endpoint}","headers":{"Authorization":"Bearer ${secret ?? "stp_mcp_…"}"}}}}`;
}

export { DEFAULT_SCOPE_COUNT, MCP_SCOPES, buildClientConfig, mcpRequest };
export type { McpActivity, McpCredential, McpData, McpKeyResponse, McpVerification };
