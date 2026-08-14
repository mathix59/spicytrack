import { spawn } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";

const rootDir = process.cwd();
const apiDir = resolve(rootDir, "apps/api");
const webDir = resolve(rootDir, "apps/web");

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });

    child.on("error", rejectPromise);
  });
}

function waitForPort(host, port, timeoutMs = 1000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = net.createConnection({ host, port });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      cleanup();
      resolvePromise(undefined);
    });
    socket.once("timeout", () => {
      cleanup();
      rejectPromise(new Error(`Timed out connecting to ${host}:${port}`));
    });
    socket.once("error", (error) => {
      cleanup();
      rejectPromise(error);
    });
  });
}

async function assertApiE2eServices() {
  const services = [
    { name: "Postgres", host: "127.0.0.1", port: 5433 },
    { name: "RustFS", host: "127.0.0.1", port: 9002 },
    { name: "Mailpit", host: "127.0.0.1", port: 8025 },
  ];

  const failures = [];

  for (const service of services) {
    try {
      await waitForPort(service.host, service.port);
    } catch {
      failures.push(`${service.name} on ${service.host}:${service.port}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      [
        "API e2e prerequisites are not ready.",
        `Missing: ${failures.join(", ")}`,
        "Start the local stack first: docker compose up -d postgres rustfs mailpit",
        "Then apply database migrations before rerunning the e2e suite.",
      ].join("\n"),
    );
  }
}

const checks = {
  "lint:fast": async () => {
    await run("./node_modules/.bin/oxlint", ["src", "test"], apiDir);
    await run("./node_modules/.bin/oxlint", ["."], webDir);
  },
  "format:check": async () => {
    await run("./node_modules/.bin/oxfmt", ["--check", "src", "test", "scripts"], apiDir);
    await run("./node_modules/.bin/oxfmt", ["--check", "src"], webDir);
  },
  typecheck: async () => {
    await run("./node_modules/.bin/tsc", ["-p", "tsconfig.json", "--noEmit"], apiDir);
    await run("./node_modules/.bin/tsc", ["-p", "tsconfig.json", "--noEmit"], webDir);
  },
  build: async () => {
    await run("./node_modules/.bin/nest", ["build"], apiDir);
    await run("./node_modules/.bin/tsc", ["-b"], webDir);
    await run("./node_modules/.bin/vite", ["build"], webDir);
  },
  "test:api": async () => {
    await run("./node_modules/.bin/jest", [], apiDir);
  },
  "test:api:e2e": async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5433/spicytrack";
    process.env.STORAGE_ENDPOINT ??= "http://localhost:9002";
    process.env.STORAGE_ACCESS_KEY_ID ??= "spicytrack";
    process.env.STORAGE_SECRET_ACCESS_KEY ??= "spicytrack-secret";
    process.env.MAILPIT_URL ??= "http://localhost:8025";

    await assertApiE2eServices();
    await run("./node_modules/.bin/jest", ["--config", "./test/jest-e2e.json"], apiDir);
  },
};

const target = process.argv[2];

if (!target || !(target in checks)) {
  console.error(
    "Usage: node scripts/run-checks.mjs <lint:fast|format:check|typecheck|build|test:api|test:api:e2e>",
  );
  process.exit(1);
}

checks[target]().catch((error) => {
  console.error(error);
  process.exit(1);
});
