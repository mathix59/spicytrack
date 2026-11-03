import { Logger } from "@nestjs/common";

import { validateProductionSecretConfiguration } from "./secrets";

export type ServiceRole = "api" | "ingest" | "worker-admin";
type Environment = Record<string, unknown>;

const DEVELOPMENT_AUTH_SECRET = "development-only-better-auth-secret-change-me";

/** Integer settings: `min` is inclusive. */
const INTEGER_SETTINGS: Record<string, number> = {
  PORT: 1,
  JOBS_CONCURRENCY: 1,
  JOBS_POLL_INTERVAL_MS: 1,
  JOBS_TIMEOUT_MS: 1,
  JOBS_SLOW_TIMEOUT_MS: 1,
  JOBS_MAX_ATTEMPTS: 1,
  JOBS_RETRY_BASE_DELAY_MS: 1,
  JOBS_SUCCEEDED_RETENTION_DAYS: 1,
  JOBS_FAILED_RETENTION_DAYS: 1,
  ALERT_DELIVERY_RETENTION_DAYS: 1,
  AUDIT_LOG_RETENTION_DAYS: 0,
  AUTOFIX_JOB_TIMEOUT_MS: 1,
  AUTOFIX_MANUAL_DAILY_CAP: 0,
  INGEST_MAX_EVENT_BYTES: 1,
  INGEST_PROJECT_EVENTS_PER_HOUR: 0,
  INGEST_ORGANIZATION_EVENTS_PER_HOUR: 0,
  AUTH_SESSION_EXPIRES_IN_SECONDS: 1,
  AUTH_SESSION_UPDATE_AGE_SECONDS: 1,
  AUTH_RATE_LIMIT_WINDOW_SECONDS: 1,
  AUTH_RATE_LIMIT_MAX: 1,
  AUTH_SIGN_IN_RATE_LIMIT_MAX: 1,
};

const BOOLEAN_SETTINGS = [
  "ALLOW_PRIVATE_WEBHOOK_URLS",
  "VCS_ALLOW_INSECURE_HTTP",
  "CODEBASE_MEMORY_MCP_AUTO_INSTALL",
];

/** URL settings; the listed keywords are accepted as well. */
const URL_SETTINGS: Record<string, string[]> = {
  BETTER_AUTH_URL: [],
  WEB_BASE_URL: [],
  APP_URL: [],
  AI_PRICING_CATALOG_URL: ["disabled"],
  SPICYTRACK_UPDATE_MANIFEST_URL: ["disabled"],
};

function text(environment: Environment, name: string): string | undefined {
  const value = environment[name];
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Every configuration problem at once, so an operator fixes them in one pass instead of one
 * crash per variable. Warnings do not block startup.
 */
export function inspectEnvironment(environment: Environment, role: ServiceRole) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = text(environment, "NODE_ENV") === "production";

  const databaseUrl = text(environment, "DATABASE_URL");
  if (!databaseUrl) {
    errors.push("DATABASE_URL is required.");
  } else if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    errors.push("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  }

  for (const [name, min] of Object.entries(INTEGER_SETTINGS)) {
    const value = text(environment, name);
    if (value === undefined) continue;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min) {
      errors.push(`${name} must be an integer ≥ ${min} (got "${value}").`);
    }
  }

  for (const name of BOOLEAN_SETTINGS) {
    const value = text(environment, name);
    if (value !== undefined && value !== "true" && value !== "false") {
      errors.push(`${name} must be "true" or "false" (got "${value}").`);
    }
  }

  for (const [name, keywords] of Object.entries(URL_SETTINGS)) {
    const value = text(environment, name);
    if (value !== undefined && !keywords.includes(value) && !isHttpUrl(value)) {
      errors.push(`${name} must be an http(s) URL (got "${value}").`);
    }
  }

  const webOrigins = text(environment, "WEB_ORIGIN");
  for (const origin of webOrigins?.split(",").map((entry) => entry.trim()) ?? []) {
    if (origin && !isHttpUrl(origin)) {
      errors.push(`WEB_ORIGIN entries must be http(s) origins (got "${origin}").`);
    }
  }

  const pricing = text(environment, "AI_PRICING_JSON");
  if (pricing !== undefined) {
    try {
      JSON.parse(pricing);
    } catch {
      errors.push("AI_PRICING_JSON must be valid JSON.");
    }
  }

  if (production && role !== "ingest") {
    try {
      validateProductionSecretConfiguration({
        NODE_ENV: "production",
        SECRETS_ENCRYPTION_KEY: text(environment, "SECRETS_ENCRYPTION_KEY"),
      });
    } catch (error) {
      errors.push((error as Error).message);
    }

    const authSecret = text(environment, "BETTER_AUTH_SECRET");
    if (!authSecret || authSecret.length < 32 || authSecret === DEVELOPMENT_AUTH_SECRET) {
      errors.push("BETTER_AUTH_SECRET must be set in production to a secret of 32+ characters.");
    }
  }

  if (production && role === "api") {
    if (!webOrigins) {
      warnings.push("WEB_ORIGIN is not set; links and CORS fall back to http://localhost:5174.");
    }
    if (!text(environment, "METRICS_TOKEN")) {
      warnings.push(
        "METRICS_TOKEN is not set; /api/metrics is readable by anything that reaches the API directly.",
      );
    }
  }

  return { errors, warnings };
}

/** ConfigModule `validate` hook: runs on the merged .env and process environment. */
export function validateEnvironment(role: ServiceRole) {
  return (environment: Environment): Environment => {
    const { errors, warnings } = inspectEnvironment(environment, role);
    const logger = new Logger("Configuration");
    for (const warning of warnings) logger.warn(warning);
    if (errors.length > 0) {
      throw new Error(
        `Invalid configuration:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
      );
    }
    return environment;
  };
}
