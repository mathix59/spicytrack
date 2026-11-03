import { inspectEnvironment, validateEnvironment } from "./environment";

const base = { DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/spicytrack" };
const productionSecrets = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "a-production-secret-of-at-least-32-characters",
  SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  WEB_ORIGIN: "https://app.example.com",
  METRICS_TOKEN: "token",
};

describe("inspectEnvironment", () => {
  it("accepts a minimal development configuration", () => {
    expect(inspectEnvironment(base, "api")).toEqual({ errors: [], warnings: [] });
  });

  it("requires a postgres DATABASE_URL", () => {
    expect(inspectEnvironment({}, "ingest").errors).toEqual(["DATABASE_URL is required."]);
    expect(inspectEnvironment({ DATABASE_URL: "mysql://x" }, "ingest").errors).toHaveLength(1);
  });

  it("reports every malformed value at once", () => {
    const { errors } = inspectEnvironment(
      {
        ...base,
        JOBS_CONCURRENCY: "0",
        PORT: "abc",
        AUDIT_LOG_RETENTION_DAYS: "-1",
        ALLOW_PRIVATE_WEBHOOK_URLS: "yes",
        BETTER_AUTH_URL: "not a url",
        WEB_ORIGIN: "https://ok.example.com, nope",
        AI_PRICING_JSON: "{",
      },
      "api",
    );

    expect(errors).toHaveLength(7);
  });

  it("accepts zero where it means unlimited or keep forever", () => {
    const environment = {
      ...base,
      AUDIT_LOG_RETENTION_DAYS: "0",
      INGEST_PROJECT_EVENTS_PER_HOUR: "0",
      AI_PRICING_CATALOG_URL: "disabled",
    };

    expect(inspectEnvironment(environment, "api").errors).toEqual([]);
  });

  it("requires strong secrets in production except for ingest", () => {
    const environment = { ...base, NODE_ENV: "production" };

    expect(inspectEnvironment(environment, "api").errors).toHaveLength(2);
    expect(inspectEnvironment(environment, "worker-admin").errors).toHaveLength(2);
    expect(inspectEnvironment(environment, "ingest").errors).toEqual([]);
    expect(
      inspectEnvironment(
        { ...environment, BETTER_AUTH_SECRET: "development-only-better-auth-secret-change-me" },
        "api",
      ).errors,
    ).toHaveLength(2);
    expect(inspectEnvironment({ ...base, ...productionSecrets }, "api")).toEqual({
      errors: [],
      warnings: [],
    });
  });

  it("warns when production metrics are unprotected", () => {
    const { warnings } = inspectEnvironment(
      { ...base, ...productionSecrets, METRICS_TOKEN: "" },
      "api",
    );

    expect(warnings).toEqual([expect.stringContaining("METRICS_TOKEN")]);
  });
});

describe("validateEnvironment", () => {
  it("returns the environment when valid and throws one aggregated error otherwise", () => {
    expect(validateEnvironment("api")(base)).toBe(base);
    expect(() => validateEnvironment("api")({ PORT: "x" })).toThrow(
      /Invalid configuration:\n {2}- DATABASE_URL is required\.\n {2}- PORT/,
    );
  });
});
