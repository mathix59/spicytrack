import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { frameworkRoots } from "./detect.js";

export const CONFIG_FILE = ".spicytrack.json";

export async function loadConfig(cwd = process.cwd(), overrides = {}) {
  let stored = {};
  try {
    stored = JSON.parse(await readFile(path.join(cwd, CONFIG_FILE), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const config = {
    ...stored,
    ...overrides,
    url: overrides.url ?? process.env.SPICYTRACK_URL ?? stored.url,
    organization: overrides.organization ?? process.env.SPICYTRACK_ORG ?? stored.organization,
    project: overrides.project ?? process.env.SPICYTRACK_PROJECT ?? stored.project,
    token: overrides.token ?? process.env.SPICYTRACK_AUTH_TOKEN,
  };
  config.roots = config.roots ?? frameworkRoots(config.framework);
  return config;
}

export async function saveConfig(cwd, config) {
  const safeConfig = { ...config };
  delete safeConfig.token;
  await writeFile(path.join(cwd, CONFIG_FILE), `${JSON.stringify(safeConfig, null, 2)}\n`);
}

export function resolveRelease(config, cwd = process.cwd()) {
  if (process.env.SPICYTRACK_RELEASE) return process.env.SPICYTRACK_RELEASE;
  if (config.release) return config.release;
  for (const environmentName of [
    "VERCEL_GIT_COMMIT_SHA",
    "GITHUB_SHA",
    "CI_COMMIT_SHA",
    "CF_PAGES_COMMIT_SHA",
    "COMMIT_REF",
  ]) {
    if (process.env[environmentName]) return process.env[environmentName];
  }
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("Could not detect a release. Set SPICYTRACK_RELEASE or config.release.");
  }
}

export function validateConfig(config, { requireToken = true } = {}) {
  const missing = ["url", "organization", "project"].filter((key) => !config[key]);
  if (requireToken && !config.token) missing.push("SPICYTRACK_AUTH_TOKEN");
  if (missing.length) throw new Error(`Missing SpicyTrack configuration: ${missing.join(", ")}`);
}
