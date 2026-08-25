import { createRelease, uploadArtifact } from "./api.js";
import { open } from "node:fs/promises";
import { loadConfig, resolveRelease, validateConfig } from "./config.js";
import { discoverArtifacts } from "./files.js";

async function parallelLimit(items, limit, operation) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await operation(item);
    }
  });
  await Promise.all(workers);
}

async function containsInlineSourceMap(artifact) {
  if (artifact.artifactName.endsWith(".map")) return true;
  const file = await open(artifact.filename, "r");
  try {
    const start = Math.max(0, artifact.size - 4096);
    const buffer = Buffer.alloc(artifact.size - start);
    await file.read(buffer, 0, buffer.length, start);
    return /sourceMappingURL\s*=\s*data:application\//.test(buffer.toString("utf8"));
  } finally {
    await file.close();
  }
}

export async function uploadSourceMaps(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd, options);
  validateConfig(config);
  const release = options.release ?? resolveRelease(config, cwd);
  const artifacts = await discoverArtifacts(cwd, config.roots);
  const sourceMapChecks = await Promise.all(artifacts.map(containsInlineSourceMap));
  if (!sourceMapChecks.some(Boolean)) {
    throw new Error(`No source maps found under: ${config.roots.join(", ")}`);
  }

  await createRelease(config, release);
  await parallelLimit(artifacts, Number(config.concurrency) || 6, async (artifact) => {
    await uploadArtifact(config, release, artifact);
    options.onUploaded?.(artifact);
  });
  return { release, artifacts };
}
