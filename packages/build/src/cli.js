#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { verifyConnection } from "./api.js";
import { CONFIG_FILE, loadConfig, resolveRelease, saveConfig, validateConfig } from "./config.js";
import { detectProject } from "./detect.js";
import { discoverArtifacts } from "./files.js";
import { uploadSourceMaps } from "./upload.js";

function parseArguments(argv) {
  const separator = argv.indexOf("--");
  const commandArguments = separator === -1 ? [] : argv.slice(separator + 1);
  const tokens = separator === -1 ? argv : argv.slice(0, separator);
  const command = tokens.shift() ?? "help";
  const flags = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith("--")) continue;
    const [name, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) flags[name] = inlineValue;
    else if (tokens[index + 1] && !tokens[index + 1].startsWith("--")) {
      flags[name] = tokens[index + 1];
      index += 1;
    } else flags[name] = true;
  }
  return { command, flags, commandArguments };
}

async function question(terminal, label, fallback) {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await terminal.question(`${label}${suffix}: `)).trim();
  return answer || fallback;
}

async function initCommand(flags) {
  const cwd = process.cwd();
  const detected = await detectProject(cwd);
  const interactive = Boolean(stdin.isTTY && stdout.isTTY);
  const terminal = interactive ? createInterface({ input: stdin, output: stdout }) : null;
  try {
    const url =
      flags.url ?? process.env.SPICYTRACK_URL ?? (await question(terminal, "SpicyTrack URL"));
    const organization =
      flags.organization ??
      process.env.SPICYTRACK_ORG ??
      (await question(terminal, "Organization slug"));
    const project =
      flags.project ?? process.env.SPICYTRACK_PROJECT ?? (await question(terminal, "Project slug"));
    const config = {
      url,
      organization,
      project,
      framework: detected.framework,
      roots: detected.roots,
    };
    validateConfig(config, { requireToken: false });
    await saveConfig(cwd, config);

    const packageFilename = path.join(cwd, "package.json");
    const packageJson = JSON.parse(await readFile(packageFilename, "utf8"));
    packageJson.devDependencies ??= {};
    packageJson.devDependencies["@spicytrack/build"] ??= "^0.1.0";
    const buildScript = packageJson.scripts?.build;
    if (buildScript && !buildScript.includes("spicytrack build")) {
      packageJson.scripts.build = `spicytrack build -- ${buildScript}`;
    }
    await writeFile(packageFilename, `${JSON.stringify(packageJson, null, 2)}\n`);
    console.log(`✓ Detected ${detected.framework}`);
    console.log(`✓ Wrote ${CONFIG_FILE}`);
    console.log("✓ Build script now uploads source maps after successful builds");
    console.log(`Next: set SPICYTRACK_AUTH_TOKEN, then run ${detected.packageManager} install`);
  } finally {
    terminal?.close();
  }
}

async function uploadCommand(flags = {}) {
  let uploaded = 0;
  const result = await uploadSourceMaps({
    release: typeof flags.release === "string" ? flags.release : undefined,
    onUploaded: () => {
      uploaded += 1;
      stdout.write(`\rUploading artifacts ${uploaded}`);
    },
  });
  stdout.write("\n");
  console.log(`✓ Uploaded ${result.artifacts.length} artifacts for release ${result.release}`);
}

async function buildCommand(flags, commandArguments) {
  if (!commandArguments.length) throw new Error("Usage: spicytrack build -- <build command>");
  const config = await loadConfig();
  const release = typeof flags.release === "string" ? flags.release : resolveRelease(config);
  const [command, ...args] = commandArguments;
  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      SENTRY_RELEASE: release,
      SPICYTRACK_RELEASE: release,
      NEXT_PUBLIC_SENTRY_RELEASE: release,
      VITE_SENTRY_RELEASE: release,
      NUXT_PUBLIC_SENTRY_RELEASE: release,
    },
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }
  await uploadCommand({ ...flags, release });
}

async function doctorCommand() {
  const cwd = process.cwd();
  const detected = await detectProject(cwd);
  const config = await loadConfig(cwd);
  validateConfig(config);
  const release = resolveRelease(config, cwd);
  const artifacts = await discoverArtifacts(cwd, config.roots);
  const sourceMaps = artifacts.filter((artifact) => artifact.artifactName.endsWith(".map"));
  await verifyConnection(config);
  console.log(`✓ Framework: ${detected.framework}`);
  console.log(`✓ API and token: connected to ${config.organization}/${config.project}`);
  console.log(`✓ Release: ${release}`);
  console.log(
    sourceMaps.length
      ? `✓ Source maps: ${sourceMaps.length} found`
      : `! Source maps: none found yet under ${config.roots.join(", ")} (run a production build)`,
  );
}

function help() {
  console.log(`SpicyTrack source maps

  spicytrack init [--url URL --organization SLUG --project SLUG]
  spicytrack build [--release VERSION] -- <build command>
  spicytrack upload [--release VERSION]
  spicytrack doctor`);
}

const { command, flags, commandArguments } = parseArguments(process.argv.slice(2));
try {
  if (command === "init") await initCommand(flags);
  else if (command === "build") await buildCommand(flags, commandArguments);
  else if (command === "upload" || command === "sourcemaps") await uploadCommand(flags);
  else if (command === "doctor") await doctorCommand();
  else help();
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
