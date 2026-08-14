import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { BadRequestException } from "@nestjs/common";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a! >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0]!;
  if (isIP(normalized) === 4) return isPrivateIpv4(normalized);
  if (isIP(normalized) !== 6) return true;
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.slice("::ffff:".length));
  }
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized)
  );
}

export function parseWebhookUrl(value: unknown): URL {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException("destinationTarget must be a non-empty URL");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException("destinationTarget must be a valid URL");
  }
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) {
    throw new BadRequestException("Webhook URLs must use HTTP(S) without credentials");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    process.env.ALLOW_PRIVATE_WEBHOOK_URLS !== "true" &&
    (hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      (isIP(hostname) > 0 && isPrivateAddress(hostname)))
  ) {
    throw new BadRequestException("Private webhook destinations are not allowed");
  }
  return url;
}

export async function assertSafeWebhookUrl(value: string): Promise<string> {
  const url = parseWebhookUrl(value);
  if (process.env.ALLOW_PRIVATE_WEBHOOK_URLS === "true" || isIP(url.hostname) > 0) {
    return url.toString();
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException("Webhook hostname could not be resolved");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new BadRequestException("Private webhook destinations are not allowed");
  }
  return url.toString();
}
