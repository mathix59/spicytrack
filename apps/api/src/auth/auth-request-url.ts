// better-auth 1.7 serves provider callbacks at `/callback/:id`. Identity providers are already
// registered with the historical `/oauth2/callback/:id` redirect URI, so it is kept as an alias.
const LEGACY_OIDC_CALLBACK_PATH = /^(\/api\/better-auth)\/oauth2\/callback\//;

export function buildBetterAuthRequestUrl(path: string): URL {
  const configuredBase = process.env.BETTER_AUTH_URL ?? "http://localhost:3002/api/better-auth";
  return new URL(
    path.replace(LEGACY_OIDC_CALLBACK_PATH, "$1/callback/"),
    new URL(configuredBase).origin,
  );
}
