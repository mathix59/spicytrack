import { writeFile } from "node:fs/promises";

const apiUrl = requiredUrl("SPICYTRACK_API_URL");
const dsn = parseDsn(required("SPICYTRACK_DSN"));
const durationMinutes = positiveNumber("SPICYTRACK_PILOT_DURATION_MINUTES", 60);
const intervalSeconds = positiveNumber("SPICYTRACK_PILOT_INTERVAL_SECONDS", 60);
const timeoutMs = positiveNumber("SPICYTRACK_PILOT_TIMEOUT_MS", 10_000);
const maximumErrorRate = ratio("SPICYTRACK_PILOT_MAX_ERROR_RATE", 0.01);
const maximumP95Ms = positiveNumber("SPICYTRACK_PILOT_MAX_P95_MS", 1_000);
const reportPath = process.env.SPICYTRACK_PILOT_REPORT?.trim();
const deadline = Date.now() + durationMinutes * 60_000;
const samples = [];

do {
  samples.push(await sample());
  if (Date.now() < deadline) await delay(Math.min(intervalSeconds * 1_000, deadline - Date.now()));
} while (Date.now() < deadline);

const latencies = samples.flatMap((entry) => entry.checks.map((check) => check.durationMs)).sort(
  (left, right) => left - right,
);
const failedChecks = samples.flatMap((entry) => entry.checks).filter((check) => !check.ok).length;
const totalChecks = samples.reduce((total, entry) => total + entry.checks.length, 0);
const errorRate = totalChecks === 0 ? 1 : failedChecks / totalChecks;
const p95Ms = percentile(latencies, 0.95);
const report = {
  status: errorRate <= maximumErrorRate && p95Ms <= maximumP95Ms ? "ok" : "failed",
  startedAt: samples[0]?.timestamp ?? new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMinutes,
  samples: samples.length,
  checks: totalChecks,
  failedChecks,
  errorRate,
  latencyMs: { p50: percentile(latencies, 0.5), p95: p95Ms, p99: percentile(latencies, 0.99) },
  thresholds: { maximumErrorRate, maximumP95Ms },
  details: samples,
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
process.stdout.write(serialized);
if (reportPath) await writeFile(reportPath, serialized, { mode: 0o600 });
if (report.status !== "ok") process.exitCode = 1;

async function sample() {
  const timestamp = new Date().toISOString();
  const checks = [];
  await runCheck(checks, "liveness", new URL("health/live", trailingSlash(apiUrl)), "GET");
  await runCheck(checks, "readiness", new URL("health/ready", trailingSlash(apiUrl)), "GET");
  await runCheck(checks, "metrics", new URL("metrics", trailingSlash(apiUrl)), "GET");

  const endpoint = new URL(`/api/${dsn.projectId}/store/`, dsn.origin);
  endpoint.searchParams.set("sentry_key", dsn.publicKey);
  await runCheck(checks, "ingestion", endpoint, "POST", {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp,
    platform: "javascript",
    level: "error",
    environment: "preproduction",
    release: "spicytrack-preproduction-pilot",
    message: "SpicyTrack preproduction pilot probe",
    tags: { synthetic: "true", source: "preproduction-pilot" },
  });
  return { timestamp, checks };
}

async function runCheck(checks, name, url, method, payload) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method,
      ...(payload ? { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.arrayBuffer();
    checks.push({ name, ok: response.ok, status: response.status, durationMs: elapsed(startedAt) });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      status: null,
      durationMs: elapsed(startedAt),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function parseDsn(value) {
  const url = new URL(value);
  const projectId = url.pathname.split("/").filter(Boolean).at(-1);
  if (!url.username || !projectId) throw new Error("SPICYTRACK_DSN is invalid");
  return { origin: url.origin, publicKey: decodeURIComponent(url.username), projectId };
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredUrl(name) {
  return new URL(required(name));
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function ratio(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be 0..1`);
  return value;
}

function trailingSlash(url) {
  const copy = new URL(url);
  if (!copy.pathname.endsWith("/")) copy.pathname += "/";
  return copy;
}

function elapsed(startedAt) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function percentile(values, value) {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * value) - 1)];
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
