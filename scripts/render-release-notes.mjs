import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const changelogs = [
  { name: "API", path: "apps/api/CHANGELOG.md" },
  { name: "Web", path: "apps/web/CHANGELOG.md" },
];

export function extractVersionSection(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);

  if (start === -1) return null;

  const next = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start + 1, next === -1 ? undefined : next).join("\n").trim();
}

function hasReleaseEntry(section) {
  return section !== null && /^-\s+/m.test(section);
}

export function renderReleaseNotes(version, entries) {
  const populated = entries
    .map((entry) => ({ ...entry, section: extractVersionSection(entry.markdown, version) }))
    .filter((entry) => hasReleaseEntry(entry.section));

  if (populated.length === 0) {
    throw new Error(`No changelog entries found for version ${version}`);
  }

  const uniqueSections = [...new Set(populated.map((entry) => entry.section))];
  const body =
    uniqueSections.length === 1
      ? uniqueSections[0]
      : populated.map((entry) => `## ${entry.name}\n\n${entry.section}`).join("\n\n");

  return `# SpicyTrack ${version}\n\n${body}\n`;
}

export function releaseVersionFromArgs(args) {
  return args.find((argument) => argument !== "--");
}

async function main() {
  const version = releaseVersionFromArgs(process.argv.slice(2));
  if (!version) throw new Error("Usage: node scripts/render-release-notes.mjs <version>");

  const entries = await Promise.all(
    changelogs.map(async ({ name, path }) => ({ name, markdown: await readFile(path, "utf8") })),
  );
  process.stdout.write(renderReleaseNotes(version.replace(/^v/, ""), entries));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
