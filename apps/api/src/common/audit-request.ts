import { AsyncLocalStorage } from "node:async_hooks";
import { BlockList, isIPv4 } from "node:net";

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

/** Addresses a proxy in front of SpicyTrack can have: loopback, private, CGNAT and link-local. */
const PRIVATE_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["127.0.0.0", 8],
  ["100.64.0.0", 10],
  ["169.254.0.0", 16],
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
] as const) {
  PRIVATE_ADDRESSES.addSubnet(network, prefix, "ipv6");
}

export function isPrivateAddress(address: string) {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  const ip = mapped ?? address;
  try {
    return PRIVATE_ADDRESSES.check(ip, isIPv4(ip) ? "ipv4" : "ipv6");
  } catch {
    return false;
  }
}

export type TrustProxy = boolean | string[] | ((address: string, hop: number) => boolean);

/**
 * Fastify's `trustProxy`: off by default so a client cannot spoof its IP with
 * X-Forwarded-For. Set TRUST_PROXY=true, a hop count, or a comma-separated list
 * of proxy addresses/CIDRs when SpicyTrack runs behind a reverse proxy.
 *
 * Fastify no longer honours a bare hop count, since a client reaching the API directly could
 * then forge the header. A hop count here only trusts hops from private addresses, which is
 * where SpicyTrack's own proxies (the web pod, Compose's nginx, an ingress controller) sit.
 */
export function trustProxySetting(value = process.env.TRUST_PROXY): TrustProxy {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "false") return false;
  if (trimmed === "true") return true;
  if (/^\d+$/.test(trimmed)) {
    const hops = Number(trimmed);
    return (address, hop) => hop < hops && isPrivateAddress(address);
  }
  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
