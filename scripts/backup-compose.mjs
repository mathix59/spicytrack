import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const backupDirectory = path.resolve(required("SPICYTRACK_BACKUP_DIR"));
mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replaceAll(":", "-");
const databasePath = path.join(backupDirectory, `postgres-${stamp}.dump`);
const storagePath = path.join(backupDirectory, `objects-${stamp}.tar.gz`);
const compose = ["compose", "-f", "docker-compose.release.yml"];

capture(databasePath, "docker", [
  ...compose,
  "exec",
  "--no-TTY",
  "postgres",
  "pg_dump",
  "-U",
  process.env.POSTGRES_USER ?? "spicytrack",
  "-d",
  process.env.POSTGRES_DB ?? "spicytrack",
  "--format=custom",
  "--no-owner",
  "--no-acl",
]);
capture(storagePath, "docker", [
  ...compose,
  "exec",
  "--no-TTY",
  "rustfs",
  "tar",
  "-C",
  "/data",
  "-czf",
  "-",
  ".",
]);

const manifest = {
  createdAt: new Date().toISOString(),
  database: fileMetadata(databasePath),
  objectStorage: fileMetadata(storagePath),
};
const manifestPath = path.join(backupDirectory, `manifest-${stamp}.json`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${manifestPath}\n`);

function capture(outputPath, command, args) {
  const descriptor = openSync(outputPath, "w", 0o600);
  try {
    const result = spawnSync(command, args, { stdio: ["ignore", descriptor, "inherit"] });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
  } finally {
    closeSync(descriptor);
  }
}

function fileMetadata(filePath) {
  const bytes = readFileSync(filePath);
  return { file: path.basename(filePath), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
