import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { detectProject } from "../src/detect.js";

async function fixture(packageJson) {
  const directory = await mkdtemp(path.join(tmpdir(), "spicytrack-detect-"));
  await writeFile(path.join(directory, "package.json"), JSON.stringify(packageJson));
  return directory;
}

test("detects Next.js before its transitive bundlers", async () => {
  const cwd = await fixture({ dependencies: { next: "latest", webpack: "latest" } });
  const result = await detectProject(cwd);
  assert.equal(result.framework, "nextjs");
  assert.deepEqual(result.roots, [".next"]);
});

test("detects each supported frontend family", async () => {
  const matrix = [
    ["nuxt", "nuxt"],
    ["@sveltejs/kit", "sveltekit"],
    ["@angular/core", "angular"],
    ["vite", "vite"],
    ["webpack", "webpack"],
    ["rollup", "rollup"],
    ["esbuild", "esbuild"],
  ];
  for (const [dependency, expected] of matrix) {
    const cwd = await fixture({ devDependencies: { [dependency]: "latest" } });
    assert.equal((await detectProject(cwd)).framework, expected);
  }
});
