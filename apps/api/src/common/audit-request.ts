import { AsyncLocalStorage } from "node:async_hooks";

/** Who is behind the current HTTP request, stamped on every audit entry it writes. */
export interface AuditRequest {
  ipAddress: string | null;
  userAgent: string | null;
  /** Filled by the auth guard when the request uses a personal access token. */
  tokenId?: string;
}

const storage = new AsyncLocalStorage<AuditRequest>();

const MAX_USER_AGENT_LENGTH = 512;

export function auditRequestFrom(request: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): AuditRequest {
  const userAgent = request.headers["user-agent"];
  return {
    ipAddress: request.ip?.slice(0, 64) || null,
    userAgent:
      (Array.isArray(userAgent) ? userAgent[0] : userAgent)?.slice(0, MAX_USER_AGENT_LENGTH) ||
      null,
  };
}

export function runWithAuditRequest<T>(request: AuditRequest, callback: () => T): T {
  return storage.run(request, callback);
}

/** Undefined outside an HTTP request (jobs, workers, scripts). */
export function currentAuditRequest(): AuditRequest | undefined {
  return storage.getStore();
}

/**
 * Fastify's `trustProxy`: off by default so a client cannot spoof its IP with
 * X-Forwarded-For. Set TRUST_PROXY=true, a hop count, or a comma-separated list
 * of proxy addresses/CIDRs when SpicyTrack runs behind a reverse proxy.
 */
export function trustProxySetting(value = process.env.TRUST_PROXY): boolean | number | string[] {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "false") return false;
  if (trimmed === "true") return true;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
