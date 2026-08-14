const apiUrl = requiredUrl("SPICYTRACK_API_URL");
const timeoutMs = positiveInteger("SPICYTRACK_SMOKE_TIMEOUT_MS", 10_000);
const dsn = process.env.SPICYTRACK_DSN?.trim();
const checks = [];

await checkJson("liveness", new URL("health/live", withTrailingSlash(apiUrl)), (payload) => {
  if (payload.status !== "ok") throw new Error(`unexpected status ${payload.status}`);
});
await checkJson("readiness", new URL("health/ready", withTrailingSlash(apiUrl)), (payload) => {
  if (payload.status !== "ok") throw new Error(`unexpected status ${payload.status}`);
});
await checkJson(
  "authentication options",
  new URL("auth/registration-status", withTrailingSlash(apiUrl)),
  (payload) => {
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.registrationsEnabled !== "boolean" ||
      typeof payload.passwordEnabled !== "boolean" ||
      !(payload.sso === null || typeof payload.sso === "object")
    ) {
      throw new Error("invalid authentication options");
    }
  },
);
await checkText("prometheus metrics", new URL("metrics", withTrailingSlash(apiUrl)), (body) => {
  if (!body.includes("spicytrack_process_uptime_seconds")) throw new Error("metric missing");
});

if (dsn) await checkIngestion(dsn);

console.log(JSON.stringify({ status: "ok", checks }, null, 2));

async function checkJson(name, url, validate) {
  const startedAt = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  const payload = await response.json();
  validate(payload && typeof payload === "object" && "data" in payload ? payload.data : payload);
  checks.push({ name, status: "ok", durationMs: roundedDuration(startedAt) });
}

async function checkText(name, url, validate) {
  const startedAt = performance.now();
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${name} returned HTTP ${response.status}`);
  validate(await response.text());
  checks.push({ name, status: "ok", durationMs: roundedDuration(startedAt) });
}

async function checkIngestion(value) {
  const parsed = parseDsn(value);
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const endpoint = new URL(`/api/${parsed.projectId}/store/`, parsed.origin);
  endpoint.searchParams.set("sentry_key", parsed.publicKey);
  const startedAt = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      environment: "preproduction",
      message: "SpicyTrack preproduction smoke event",
      tags: { synthetic: "true", source: "preproduction-smoke" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`ingestion returned HTTP ${response.status}`);
  checks.push({ name: "event ingestion", status: "ok", durationMs: roundedDuration(startedAt) });
}

function parseDsn(value) {
  const url = new URL(value);
  const projectId = url.pathname.split("/").filter(Boolean).at(-1);
  if (!url.username || !projectId) throw new Error("SPICYTRACK_DSN is invalid");
  return { origin: url.origin, publicKey: decodeURIComponent(url.username), projectId };
}

function requiredUrl(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return new URL(value);
}

function withTrailingSlash(url) {
  const copy = new URL(url);
  if (!copy.pathname.endsWith("/")) copy.pathname += "/";
  return copy;
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function roundedDuration(startedAt) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
