import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const packageFiles = [
  "apps/api/package.json",
  "apps/web/package.json",
];

async function readPackageVersion(filePath) {
  const raw = await readFile(filePath, "utf8");
  const manifest = JSON.parse(raw);
  return { filePath, name: manifest.name, version: manifest.version };
}

async function gitTagExists(tagName) {
  try {
    await execFileAsync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const shouldPush = process.argv.includes("--push");
  const isDryRun = process.argv.includes("--dry-run");
  const packages = await Promise.all(packageFiles.map(readPackageVersion));
  const versions = [...new Set(packages.map((pkg) => pkg.version))];

  if (versions.length !== 1) {
    const details = packages.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ");
    throw new Error(`Workspace packages are not aligned on one version: ${details}`);
  }

  const version = versions[0];
  const tagName = `v${version}`;

  if (await gitTagExists(tagName)) {
    console.log(`Git tag ${tagName} already exists, skipping tag creation`);
    return;
  }

  if (isDryRun) {
    console.log(`Would create git tag ${tagName}`);
    if (shouldPush) {
      console.log(`Would push git tag ${tagName}`);
    }
    return;
  }

  await execFileAsync("git", ["tag", "-a", tagName, "-m", tagName]);
  console.log(`Created git tag ${tagName}`);

  if (!shouldPush) {
    console.log(`Push it with: git push origin ${tagName}`);
    return;
  }

  await execFileAsync("git", ["push", "origin", tagName]);
  console.log(`Pushed git tag ${tagName}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
