import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".map"]);

async function walk(cwd, directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(cwd, filename, output);
    else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      const metadata = await stat(filename);
      output.push({
        filename,
        artifactName: path.relative(cwd, filename).split(path.sep).join("/"),
        size: metadata.size,
      });
    }
  }
}

export async function discoverArtifacts(cwd, roots) {
  const artifacts = [];
  for (const configuredRoot of roots) {
    const root = path.resolve(cwd, configuredRoot);
    try {
      await walk(cwd, root, artifacts);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return artifacts.sort((left, right) => left.artifactName.localeCompare(right.artifactName));
}
