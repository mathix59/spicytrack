import { resolveAuthenticationConfiguration } from "./oidc-config";

describe("OIDC configuration", () => {
  it("keeps password authentication enabled when OIDC is not configured", () => {
    expect(resolveAuthenticationConfiguration({})).toEqual({
      passwordEnabled: true,
      secret: "development-only-better-auth-secret-change-me",
      sessionExpiresInSeconds: 604800,
      sessionUpdateAgeSeconds: 86400,
      rateLimitWindowSeconds: 60,
      rateLimitMax: 100,
      signInRateLimitMax: 10,
      oidc: null,
    });
  });

  it("builds a secure generic OIDC configuration", () => {
    expect(
      resolveAuthenticationConfiguration({
        AUTH_PASSWORD_ENABLED: "false",
        OIDC_DISCOVERY_URL: "https://login.example.com/.well-known/openid-configuration",
        OIDC_CLIENT_ID: "spicytrack",
        OIDC_CLIENT_SECRET: "secret",
        OIDC_PROVIDER_ID: "corporate",
        OIDC_PROVIDER_NAME: "Corporate login",
        OIDC_DISABLE_SIGN_UP: "true",
      }),
    ).toEqual({
      passwordEnabled: false,
      oidc: {
        providerId: "corporate",
        providerName: "Corporate login",
        discoveryUrl: "https://login.example.com/.well-known/openid-configuration",
        clientId: "spicytrack",
        clientSecret: "secret",
        accessMode: "existing",
        requireVerifiedEmail: true,
        autoJoinOrganizationSlug: null,
        autoJoinEmailDomains: [],
      },
      secret: "development-only-better-auth-secret-change-me",
      sessionExpiresInSeconds: 604800,
      sessionUpdateAgeSeconds: 86400,
      rateLimitWindowSeconds: 60,
      rateLimitMax: 100,
      signInRateLimitMax: 10,
    });
  });

  it("requires an invitation by default and validates explicit access modes", () => {
    const baseEnvironment = {
      OIDC_DISCOVERY_URL: "https://login.example.com/.well-known/openid-configuration",
      OIDC_CLIENT_ID: "spicytrack",
      OIDC_CLIENT_SECRET: "secret",
    };

    expect(resolveAuthenticationConfiguration(baseEnvironment).oidc?.accessMode).toBe("invited");
    expect(
      resolveAuthenticationConfiguration({ ...baseEnvironment, OIDC_ACCESS_MODE: "open" }).oidc
        ?.accessMode,
    ).toBe("open");
    expect(
      resolveAuthenticationConfiguration({
        ...baseEnvironment,
        OIDC_DISABLE_SIGN_UP: "false",
      }).oidc?.accessMode,
    ).toBe("open");
    expect(() =>
      resolveAuthenticationConfiguration({ ...baseEnvironment, OIDC_ACCESS_MODE: "members" }),
    ).toThrow("OIDC_ACCESS_MODE");
  });

  it("rejects partial OIDC credentials", () => {
    expect(() =>
      resolveAuthenticationConfiguration({
        OIDC_DISCOVERY_URL: "https://login.example.com/.well-known/openid-configuration",
        OIDC_CLIENT_ID: "spicytrack",
      }),
    ).toThrow("must be configured together");
  });

  it("rejects unsafe provider identifiers and invalid boolean values", () => {
    expect(() =>
      resolveAuthenticationConfiguration({
        OIDC_DISCOVERY_URL: "https://login.example.com/.well-known/openid-configuration",
        OIDC_CLIENT_ID: "spicytrack",
        OIDC_CLIENT_SECRET: "secret",
        OIDC_PROVIDER_ID: "Company SSO",
      }),
    ).toThrow("OIDC_PROVIDER_ID");
    expect(() => resolveAuthenticationConfiguration({ AUTH_PASSWORD_ENABLED: "yes" })).toThrow(
      "AUTH_PASSWORD_ENABLED",
    );
  });

  it("prevents disabling every interactive login method", () => {
    expect(() => resolveAuthenticationConfiguration({ AUTH_PASSWORD_ENABLED: "false" })).toThrow(
      "unless OIDC is configured",
    );
  });

  it("requires an organization and domains together for automatic joining", () => {
    expect(() =>
      resolveAuthenticationConfiguration({
        OIDC_DISCOVERY_URL: "https://login.example.com/.well-known/openid-configuration",
        OIDC_CLIENT_ID: "spicytrack",
        OIDC_CLIENT_SECRET: "secret",
        OIDC_AUTO_JOIN_ORGANIZATION_SLUG: "engineering",
      }),
    ).toThrow("must be configured together");
  });

  it("rejects weak production secrets", () => {
    expect(() =>
      resolveAuthenticationConfiguration({ NODE_ENV: "production", BETTER_AUTH_SECRET: "short" }),
    ).toThrow("strong secret");
  });
});
