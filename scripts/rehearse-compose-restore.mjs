import { closeSync, openSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const databaseBackup = path.resolve(required("SPICYTRACK_DATABASE_BACKUP"));
const objectBackup = path.resolve(required("SPICYTRACK_OBJECT_BACKUP"));
const container = `spicytrack-restore-rehearsal-${process.pid}`;

try {
  run("docker", [
    "run",
    "--detach",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=rehearsal-only",
    "-e",
    "POSTGRES_DB=spicytrack",
    "postgres:17-alpine",
  ]);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], {
      stdio: "ignore",
    });
    if (ready.status === 0) break;
    if (attempt === 29) throw new Error("Restore rehearsal PostgreSQL did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  pipe(databaseBackup, "docker", [
    "exec",
    "--interactive",
    container,
    "pg_restore",
    "-U",
    "postgres",
    "-d",
    "spicytrack",
    "--no-owner",
    "--no-acl",
  ]);
  run("docker", [
    "exec",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "spicytrack",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "SELECT COUNT(*) AS projects FROM projects; SELECT COUNT(*) AS events FROM events;",
  ]);
  pipe(objectBackup, "docker", ["run", "--rm", "--interactive", "alpine:3.23", "tar", "-tzf", "-"]);
  process.stdout.write("Restore rehearsal passed.\n");
} finally {
  spawnSync("docker", ["rm", "--force", container], { stdio: "ignore" });
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

function pipe(inputPath, command, args) {
  const descriptor = openSync(inputPath, "r");
  try {
    const result = spawnSync(command, args, { stdio: [descriptor, "inherit", "inherit"] });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
  } finally {
    closeSync(descriptor);
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
