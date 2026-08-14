type Environment = Record<string, string | undefined>;

export type OidcConfiguration = {
  providerId: string;
  providerName: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  accessMode: "open" | "existing" | "invited";
  requireVerifiedEmail: boolean;
  autoJoinOrganizationSlug: string | null;
  autoJoinEmailDomains: string[];
};

function oidcAccessMode(environment: Environment): OidcConfiguration["accessMode"] {
  const configuredMode = optionalValue(environment, "OIDC_ACCESS_MODE");
  if (configuredMode) {
    if (
      configuredMode === "open" ||
      configuredMode === "existing" ||
      configuredMode === "invited"
    ) {
      return configuredMode;
    }
    throw new Error("OIDC_ACCESS_MODE must be open, existing or invited");
  }

  const legacyDisableSignUp = optionalValue(environment, "OIDC_DISABLE_SIGN_UP");
  if (legacyDisableSignUp !== undefined) {
    return booleanValue(legacyDisableSignUp, false, "OIDC_DISABLE_SIGN_UP") ? "existing" : "open";
  }

  return "invited";
}

export type AuthenticationConfiguration = {
  passwordEnabled: boolean;
  secret: string;
  sessionExpiresInSeconds: number;
  sessionUpdateAgeSeconds: number;
  rateLimitWindowSeconds: number;
  rateLimitMax: number;
  signInRateLimitMax: number;
  oidc: OidcConfiguration | null;
};

function booleanValue(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined || value.trim() === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

function optionalValue(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  return value ? value : undefined;
}

function positiveIntegerValue(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function emailDomains(value: string | undefined) {
  if (!value) return [];
  const domains = [
    ...new Set(value.split(",").map((domain) => domain.trim().toLowerCase())),
  ].filter(Boolean);
  if (domains.some((domain) => !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))) {
    throw new Error("OIDC_AUTO_JOIN_EMAIL_DOMAINS contains an invalid domain");
  }
  return domains;
}

export function resolveAuthenticationConfiguration(
  environment: Environment = process.env,
): AuthenticationConfiguration {
  const discoveryUrl = optionalValue(environment, "OIDC_DISCOVERY_URL");
  const clientId = optionalValue(environment, "OIDC_CLIENT_ID");
  const clientSecret = optionalValue(environment, "OIDC_CLIENT_SECRET");
  const configuredValues = [discoveryUrl, clientId, clientSecret];
  const isConfigured = configuredValues.some(Boolean);

  let oidc: OidcConfiguration | null = null;
  if (isConfigured) {
    if (!configuredValues.every(Boolean)) {
      throw new Error(
        "OIDC_DISCOVERY_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be configured together",
      );
    }

    const parsedDiscoveryUrl = new URL(discoveryUrl!);
    if (parsedDiscoveryUrl.protocol !== "https:" && parsedDiscoveryUrl.protocol !== "http:") {
      throw new Error("OIDC_DISCOVERY_URL must use http or https");
    }

    const providerId = optionalValue(environment, "OIDC_PROVIDER_ID") ?? "company-sso";
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(providerId)) {
      throw new Error("OIDC_PROVIDER_ID must contain only lowercase letters, numbers, _ or -");
    }

    const autoJoinOrganizationSlug =
      optionalValue(environment, "OIDC_AUTO_JOIN_ORGANIZATION_SLUG") ?? null;
    const autoJoinEmailDomains = emailDomains(environment.OIDC_AUTO_JOIN_EMAIL_DOMAINS);
    if (Boolean(autoJoinOrganizationSlug) !== autoJoinEmailDomains.length > 0) {
      throw new Error(
        "OIDC_AUTO_JOIN_ORGANIZATION_SLUG and OIDC_AUTO_JOIN_EMAIL_DOMAINS must be configured together",
      );
    }

    oidc = {
      providerId,
      providerName: optionalValue(environment, "OIDC_PROVIDER_NAME") ?? "Company SSO",
      discoveryUrl: discoveryUrl!,
      clientId: clientId!,
      clientSecret: clientSecret!,
      accessMode: oidcAccessMode(environment),
      requireVerifiedEmail: booleanValue(
        environment.OIDC_REQUIRE_VERIFIED_EMAIL,
        true,
        "OIDC_REQUIRE_VERIFIED_EMAIL",
      ),
      autoJoinOrganizationSlug,
      autoJoinEmailDomains,
    };
  }

  const passwordEnabled = booleanValue(
    environment.AUTH_PASSWORD_ENABLED,
    true,
    "AUTH_PASSWORD_ENABLED",
  );
  if (!passwordEnabled && !oidc) {
    throw new Error("AUTH_PASSWORD_ENABLED cannot be false unless OIDC is configured");
  }

  const secret =
    optionalValue(environment, "BETTER_AUTH_SECRET") ??
    "development-only-better-auth-secret-change-me";
  if (
    environment.NODE_ENV === "production" &&
    (secret.length < 32 || secret === "development-only-better-auth-secret-change-me")
  ) {
    throw new Error("BETTER_AUTH_SECRET must be a strong secret of at least 32 characters");
  }

  return {
    passwordEnabled,
    secret,
    sessionExpiresInSeconds: positiveIntegerValue(
      environment.AUTH_SESSION_EXPIRES_IN_SECONDS,
      7 * 24 * 60 * 60,
      "AUTH_SESSION_EXPIRES_IN_SECONDS",
    ),
    sessionUpdateAgeSeconds: positiveIntegerValue(
      environment.AUTH_SESSION_UPDATE_AGE_SECONDS,
      24 * 60 * 60,
      "AUTH_SESSION_UPDATE_AGE_SECONDS",
    ),
    rateLimitWindowSeconds: positiveIntegerValue(
      environment.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      60,
      "AUTH_RATE_LIMIT_WINDOW_SECONDS",
    ),
    rateLimitMax: positiveIntegerValue(environment.AUTH_RATE_LIMIT_MAX, 100, "AUTH_RATE_LIMIT_MAX"),
    signInRateLimitMax: positiveIntegerValue(
      environment.AUTH_SIGN_IN_RATE_LIMIT_MAX,
      10,
      "AUTH_SIGN_IN_RATE_LIMIT_MAX",
    ),
    oidc,
  };
}

export const authenticationConfiguration = resolveAuthenticationConfiguration();

export function publicAuthenticationOptions() {
  return {
    passwordEnabled: authenticationConfiguration.passwordEnabled,
    sso: authenticationConfiguration.oidc
      ? {
          providerId: authenticationConfiguration.oidc.providerId,
          providerName: authenticationConfiguration.oidc.providerName,
        }
      : null,
  };
}
