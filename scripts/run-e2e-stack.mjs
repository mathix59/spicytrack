import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const compose = ["compose", "-p", "spicytrack-e2e", "-f", "docker-compose.e2e.yml"];
const keepStack = process.env.E2E_KEEP_STACK === "true";
const skipBuild = process.env.E2E_SKIP_BUILD === "true";
const sdkMatrixOnly = process.env.E2E_SDK_MATRIX_ONLY === "true";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { COMPOSE_PROGRESS: "plain", ...process.env, ...options.env },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
}

function dockerCompose(...args) {
  return run("docker", [...compose, ...args]);
}

function captureDockerCompose(...args) {
  const result = spawnSync("docker", [...compose, ...args], {
    cwd: process.cwd(),
    env: { COMPOSE_PROGRESS: "plain", ...process.env },
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exitCode = result.status ?? 1;
    return null;
  }
  return result.stdout.trim();
}

function resolveE2eDsn() {
  const row = captureDockerCompose(
    "exec",
    "--no-TTY",
    "postgres",
    "psql",
    "-U",
    "spicytrack",
    "-d",
    "spicytrack",
    "-At",
    "-F",
    ":",
    "-c",
    `SELECT project_keys.public_key, projects.public_id
     FROM project_keys JOIN projects ON projects.id = project_keys.project_id
     WHERE projects.slug = 'checkout-api' AND project_keys.is_active = true
     ORDER BY project_keys.created_at LIMIT 1`,
  );
  if (!row) return null;
  const [publicKey, publicId] = row.split(":");
  if (!publicKey || !publicId) throw new Error("Could not resolve the SDK matrix DSN");
  return {
    internal: `http://${publicKey}@web:8080/${publicId}`,
    host: `http://${publicKey}@127.0.0.1:55174/${publicId}`,
  };
}

function runIngestLoad() {
  const dsn = resolveE2eDsn();
  if (!dsn) return false;
  return run("node", ["scripts/load-ingest.mjs"], {
    env: {
      SPICYTRACK_LOAD_CONFIRM: "yes",
      SPICYTRACK_DSN: dsn.host,
      SPICYTRACK_LOAD_CONCURRENCY: "4",
      SPICYTRACK_LOAD_DURATION_SECONDS: "3",
      SPICYTRACK_LOAD_MAX_ERROR_RATE: "0",
      SPICYTRACK_LOAD_MAX_P95_MS: "2000",
    },
  });
}

async function authenticatedApiClient() {
  const response = await fetch("http://127.0.0.1:55174/api/better-auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:55174",
    },
    body: JSON.stringify({ email: "owner@spicytrack.local", password: "Sup3rSecret!42" }),
  });
  if (!response.ok) {
    console.error(`[sdk-matrix] sign-in failed: ${response.status} ${await response.text()}`);
    return null;
  }

  const cookies = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie") ?? ""];
  const cookie = cookies
    .filter(Boolean)
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  return (path, options = {}) =>
    fetch(`http://127.0.0.1:55174/api${path}`, {
      ...options,
      headers: { ...options.headers, cookie, origin: "http://127.0.0.1:55174" },
    });
}

async function uploadSdkArtifact(api, release, filename, localPath) {
  const releasePath = `/organizations/e2e-company/projects/checkout-api/releases/${encodeURIComponent(release)}`;
  const upsert = await api(releasePath, { method: "PUT" });
  if (!upsert.ok) {
    console.error(
      `[sdk-matrix] release ${release} failed: ${upsert.status} ${await upsert.text()}`,
    );
    return false;
  }

  const form = new FormData();
  form.append("file", new Blob([await readFile(localPath)]), filename);
  const upload = await api(`${releasePath}/artifacts`, { method: "POST", body: form });
  if (!upload.ok) {
    console.error(
      `[sdk-matrix] artifact ${filename} failed: ${upload.status} ${await upload.text()}`,
    );
    return false;
  }
  return true;
}

async function validateSdkFrameResolution(api) {
  const expectations = [
    ["Node", "sdk-node@10.69.0", "original"],
    ["Python", "sdk-python@2.66.1", "original"],
    ["Go", "sdk-go@0.48.0", "original"],
    ["Java", "sdk-java@8.52.0", "proguard"],
    [".NET", "sdk-dotnet@6.8.0", "original"],
    ["PHP", "sdk-php@4.30.0", "original"],
    ["Ruby", "sdk-ruby@6.7.0", "original"],
    ["Rust", "sdk-rust@0.49.1", null],
    ["Dart", "sdk-dart@9.26.0", "dart_obfuscation"],
  ];
  let valid = true;

  for (const [sdk, release, resolution] of expectations) {
    let issue;
    for (let attempt = 1; attempt <= 60 && !issue; attempt += 1) {
      const issuesResponse = await api(
        `/organizations/e2e-company/projects/checkout-api/issues?release=${encodeURIComponent(release)}`,
      );
      if (!issuesResponse.ok) return false;
      const issues = await issuesResponse.json();
      issue = issues.items?.[0];
      if (!issue) await delay(500);
    }
    if (!issue) {
      console.error(`[sdk-matrix] issue missing after 30 seconds for ${sdk} release ${release}`);
      return false;
    }

    const issueResponse = await api(
      `/organizations/e2e-company/projects/checkout-api/issues/${issue.id}`,
    );
    if (!issueResponse.ok) return false;
    const detail = await issueResponse.json();
    const eventId = detail.events?.items?.[0]?.id;
    const eventResponse = await api(
      `/organizations/e2e-company/projects/checkout-api/events/${eventId}`,
    );
    if (!eventResponse.ok) return false;
    const event = await eventResponse.json();
    if (resolution && !event.resolvedFrames?.some((frame) => frame.resolution === resolution)) {
      console.error(`[sdk-matrix] ${sdk} did not produce a ${resolution} frame`);
      console.error(JSON.stringify(event.resolvedFrames ?? [], null, 2));
      console.error(JSON.stringify(event.rawPayload ?? {}, null, 2));
      valid = false;
      continue;
    }
    console.log(`[sdk-matrix] ${sdk}: ${resolution ?? "event ingested (SDK emitted no stack)"}`);
  }
  return valid;
}

async function validateArtifactUploadLimit(api) {
  const release = "upload-limit-probe@1.0.0";
  const releasePath = `/organizations/e2e-company/projects/checkout-api/releases/${encodeURIComponent(release)}`;
  const upsert = await api(releasePath, { method: "PUT" });
  if (!upsert.ok) return false;

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]),
    "over-configured-limit.map",
  );
  const response = await api(`${releasePath}/artifacts`, { method: "POST", body: form });
  if (response.status !== 413) {
    console.error(
      `[sdk-matrix] configured upload limit expected 413, received ${response.status} ${await response.text()}`,
    );
    return false;
  }
  console.log("[sdk-matrix] configurable 5 MiB artifact limit enforced");
  return true;
}

async function runSdkMatrix() {
  const dsn = resolveE2eDsn();
  if (!dsn) return false;
  const api = await authenticatedApiClient();
  if (!api) return false;
  if (
    !(await validateArtifactUploadLimit(api)) ||
    !(await uploadSdkArtifact(
      api,
      "sdk-java@8.52.0",
      "mapping.txt",
      "e2e/sdk-matrix/java/mapping.txt",
    )) ||
    !(await uploadSdkArtifact(
      api,
      "sdk-dart@9.26.0",
      "dart-obfuscation-map.json",
      "e2e/sdk-matrix/dart/dart-obfuscation-map.json",
    ))
  ) {
    return false;
  }
  const environment = { E2E_SDK_DSN: dsn.internal };
  const profile = [...compose, "--profile", "sdk-tests"];
  const services = [
    "sdk-node",
    "sdk-python",
    "sdk-go",
    "sdk-java",
    "sdk-dotnet",
    "sdk-php",
    "sdk-ruby",
    "sdk-rust",
    "sdk-dart",
  ];
  if (!skipBuild && !run("docker", [...profile, "build", ...services], { env: environment })) {
    return false;
  }
  const sent = services.every((service) =>
    run("docker", [...profile, "run", "--rm", "--no-deps", service], { env: environment }),
  );
  return sent && (await validateSdkFrameResolution(api));
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const READINESS_WAIT_TIMEOUT_MS = 60_000;
const READINESS_REQUEST_TIMEOUT_MS = 5_000;

function probeReadiness() {
  const probe = `
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health/ready", {
        signal: AbortSignal.timeout(${READINESS_REQUEST_TIMEOUT_MS}),
      });
      const payload = await response.json();
      process.stdout.write(JSON.stringify({ status: response.status, payload }));
    } catch (error) {
      process.stderr.write(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  `;
  const result = spawnSync(
    "docker",
    [...compose, "exec", "--no-TTY", "api-web", "node", "--input-type=module", "--eval", probe],
    {
      cwd: process.cwd(),
      env: { COMPOSE_PROGRESS: "plain", ...process.env },
      encoding: "utf8",
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    return { error: result.stderr.trim() || `probe exited with status ${result.status}` };
  }
  return JSON.parse(result.stdout);
}

async function waitForReadiness(predicate, label) {
  const deadline = Date.now() + READINESS_WAIT_TIMEOUT_MS;
  let lastObservation = "no response";

  while (Date.now() < deadline) {
    try {
      const observation = probeReadiness();
      if ("error" in observation) {
        lastObservation = observation.error;
      } else {
        lastObservation = `${observation.status} ${JSON.stringify(observation.payload)}`;
      }
      if (
        !("error" in observation) &&
        predicate({ status: observation.status }, observation.payload)
      ) {
        console.log(`[resilience] ${label} (${observation.status})`);
        return true;
      }
    } catch (error) {
      // A dependency transition can briefly invalidate an existing connection.
      lastObservation = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }

  console.error(
    `[resilience] timed out waiting for ${label}; last observation: ${lastObservation}`,
  );
  return false;
}

function serviceIsRunning(service) {
  return Boolean(captureDockerCompose("ps", "--status", "running", "--quiet", service));
}

async function runDependencyRecovery() {
  console.log("[resilience] validating PostgreSQL failure and recovery");
  if (!dockerCompose("stop", "postgres")) return false;
  if (
    !(await waitForReadiness(
      (response, payload) => response.status === 503 && payload?.dependencies?.database === "error",
      "database outage detected",
    ))
  ) {
    return false;
  }

  // Cover both the 5-second slow-job lane and the 30-second regular-job lane.
  await delay(31_000);
  if (!serviceIsRunning("api-web") || !serviceIsRunning("api-worker-admin")) {
    console.error("[resilience] an API process exited during the database outage");
    return false;
  }

  if (!dockerCompose("start", "postgres")) return false;
  if (
    !(await waitForReadiness(
      (response, payload) => response.status === 200 && payload?.dependencies?.database === "ok",
      "database recovery detected",
    ))
  ) {
    return false;
  }

  console.log("[resilience] validating RustFS failure and recovery");
  if (!dockerCompose("stop", "rustfs")) return false;
  if (
    !(await waitForReadiness(
      (response, payload) => response.status === 503 && payload?.dependencies?.storage === "error",
      "storage outage detected",
    ))
  ) {
    return false;
  }
  if (!serviceIsRunning("api-web") || !serviceIsRunning("api-worker-admin")) {
    console.error("[resilience] an API process exited during the storage outage");
    return false;
  }

  if (!dockerCompose("start", "rustfs")) return false;
  return waitForReadiness(
    (response, payload) => response.status === 200 && payload?.dependencies?.storage === "ok",
    "storage recovery detected",
  );
}

function cleanup() {
  if (!keepStack) dockerCompose("down", "--volumes", "--remove-orphans");
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

dockerCompose("down", "--volumes", "--remove-orphans");

try {
  const upArgs = ["up", "--detach", "--wait"];
  if (!skipBuild) upArgs.splice(2, 0, "--build");
  if (!dockerCompose(...upArgs)) {
    dockerCompose("logs", "--no-color");
    process.exitCode = 1;
  } else if (
    !run(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        ...(sdkMatrixOnly
          ? ["--grep", "validates the deployed error-tracking workflow"]
          : []),
      ],
      {
      env: {
        E2E_WEB_URL: "http://127.0.0.1:55174",
        E2E_MAILPIT_URL: "http://127.0.0.1:58025",
      },
      },
    )
  ) {
    dockerCompose("logs", "--no-color");
  } else if (!runIngestLoad()) {
    dockerCompose("logs", "--no-color");
  } else if (!(await runSdkMatrix())) {
    dockerCompose("logs", "--no-color");
    process.exitCode = 1;
  } else if (sdkMatrixOnly) {
    console.log("[sdk-matrix] focused real-SDK validation passed");
  } else if (
    !dockerCompose(
      "exec",
      "--no-TTY",
      "postgres",
      "psql",
      "-U",
      "spicytrack",
      "-d",
      "spicytrack",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "/e2e/verify-keycloak.sql",
    )
  ) {
    dockerCompose("logs", "--no-color");
  } else if (!(await runDependencyRecovery())) {
    dockerCompose("logs", "--no-color");
    process.exitCode = 1;
  } else if (
    !dockerCompose(
      "exec",
      "--no-TTY",
      "postgres",
      "psql",
      "-U",
      "spicytrack",
      "-d",
      "spicytrack",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "UPDATE instance_settings SET smtp_host = '127.0.0.1', smtp_port = 51025 WHERE id = true",
    )
  ) {
    dockerCompose("logs", "--no-color");
  } else {
    run("pnpm", ["--filter", "api", "test:e2e", "--runInBand"], {
      env: {
        DATABASE_URL: "postgresql://spicytrack:spicytrack@127.0.0.1:55433/spicytrack",
        E2E_DATABASE_URL: "postgresql://spicytrack:spicytrack@127.0.0.1:55433/spicytrack",
        MAILPIT_URL: "http://127.0.0.1:58025",
        E2E_SMTP_HOST: "127.0.0.1",
        E2E_SMTP_PORT: "51025",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "51025",
        STORAGE_ENDPOINT: "http://127.0.0.1:59002",
        STORAGE_REGION: "us-east-1",
        STORAGE_ACCESS_KEY_ID: "spicytrack",
        STORAGE_SECRET_ACCESS_KEY: "spicytrack-e2e-secret",
        STORAGE_BUCKET: "spicytrack-e2e-artifacts",
        STORAGE_FORCE_PATH_STYLE: "true",
        BETTER_AUTH_SECRET: "spicytrack-e2e-secret-at-least-32-characters",
        BETTER_AUTH_URL: "http://127.0.0.1:55174/api/better-auth",
        WEB_ORIGIN: "http://127.0.0.1:55174",
        PUBLIC_BASE_URL: "http://127.0.0.1:55174",
        WEB_BASE_URL: "http://127.0.0.1:55174",
        SECRETS_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
    });
  }
} finally {
  cleanup();
}
