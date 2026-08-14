export function buildBetterAuthRequestUrl(path: string): URL {
  const configuredBase = process.env.BETTER_AUTH_URL ?? "http://localhost:3002/api/better-auth";
  return new URL(path, new URL(configuredBase).origin);
}
