if (process.env.SPICYTRACK_LOAD_CONFIRM !== "yes") {
  throw new Error("Set SPICYTRACK_LOAD_CONFIRM=yes to confirm the target is allowed to receive load.");
}

const dsn = parseDsn(required("SPICYTRACK_DSN"));
const concurrency = positiveInteger("SPICYTRACK_LOAD_CONCURRENCY", 10);
const durationSeconds = positiveInteger("SPICYTRACK_LOAD_DURATION_SECONDS", 30);
const maximumErrorRate = ratio("SPICYTRACK_LOAD_MAX_ERROR_RATE", 0.01);
const maximumP95Ms = positiveNumber("SPICYTRACK_LOAD_MAX_P95_MS", 1_000);
const endpoint = new URL(`/api/${dsn.projectId}/store/`, dsn.origin);
endpoint.searchParams.set("sentry_key", dsn.publicKey);
const deadline = Date.now() + durationSeconds * 1_000;
const latencies = [];
let accepted = 0;
let failed = 0;

await Promise.all(Array.from({ length: concurrency }, (_, worker) => runWorker(worker)));

latencies.sort((left, right) => left - right);
const total = accepted + failed;
const errorRate = total === 0 ? 1 : failed / total;
const p95Ms = percentile(latencies, 0.95);
const result = {
  status: errorRate <= maximumErrorRate && p95Ms <= maximumP95Ms ? "ok" : "failed",
  durationSeconds,
  concurrency,
  requests: total,
  accepted,
  failed,
  requestsPerSecond: Math.round((total / durationSeconds) * 100) / 100,
  errorRate: Math.round(errorRate * 10_000) / 10_000,
  latencyMs: {
    p50: percentile(latencies, 0.5),
    p95: p95Ms,
    p99: percentile(latencies, 0.99),
    max: latencies.at(-1) ?? 0,
  },
  thresholds: { maximumErrorRate, maximumP95Ms },
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "ok") process.exitCode = 1;

async function runWorker(worker) {
  let sequence = 0;
  while (Date.now() < deadline) {
    const startedAt = performance.now();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: crypto.randomUUID().replaceAll("-", ""),
          timestamp: new Date().toISOString(),
          platform: "javascript",
          level: "error",
          environment: "load-test",
          release: "spicytrack-load-test",
          message: "Synthetic grouped ingestion load event",
          culprit: "scripts/load-ingest.mjs",
          tags: { synthetic: "true", worker: String(worker), sequence: String(sequence) },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) accepted += 1;
      else failed += 1;
      await response.arrayBuffer();
    } catch {
      failed += 1;
    } finally {
      latencies.push(Math.round((performance.now() - startedAt) * 100) / 100);
      sequence += 1;
    }
  }
}

function parseDsn(value) {
  const url = new URL(value);
  const projectId = url.pathname.split("/").filter(Boolean).at(-1);
  if (!url.username || !projectId) throw new Error("SPICYTRACK_DSN is invalid");
  return { origin: url.origin, publicKey: decodeURIComponent(url.username), projectId };
}

function percentile(values, ratioValue) {
  if (values.length === 0) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratioValue) - 1)];
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

function ratio(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
  return value;
}
