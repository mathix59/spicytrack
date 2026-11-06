// Copies the API package version (set by Changesets) to every other place that states the
// release version. With --check, only reports the files that are out of date.
import { readFileSync, writeFileSync } from "node:fs";

const check = process.argv.includes("--check");
const { version } = JSON.parse(readFileSync("apps/api/package.json", "utf8"));

const targets = [
  ["package.json", /^(  "version": ")[^"]+(",)$/m],
  ["charts/spicytrack/Chart.yaml", /^(version: )\S+()$/m],
  ["charts/spicytrack/Chart.yaml", /^(appVersion: ")[^"]+(")$/m],
  ["apps/api/src/openapi/swagger.ts", /(\.setVersion\(")[^"]+("\))/],
  ["apps/web/openapi/spicytrack.json", /("info": \{[^}]*?"version": ")[^"]+(")/],
  ["apps/web/src/generated/api.ts", /^( \* OpenAPI spec version: ).+()$/m],
  [".env.paas.example", /^(VERSION=).+()$/m],
];

const stale = new Set();
for (const [file, pattern] of targets) {
  const content = readFileSync(file, "utf8");
  if (!pattern.test(content)) throw new Error(`No version found in ${file} (${pattern})`);
  const updated = content.replace(pattern, `$1${version}$2`);
  if (updated === content) continue;
  stale.add(file);
  if (!check) writeFileSync(file, updated);
}

if (check && stale.size > 0) {
  console.error(`Release version ${version} is not applied to: ${[...stale].join(", ")}.`);
  console.error("Run `node scripts/sync-release-version.mjs`.");
  process.exit(1);
}
console.log(
  stale.size > 0
    ? `Set version ${version} in ${[...stale].join(", ")}`
    : `All files state ${version}`,
);
