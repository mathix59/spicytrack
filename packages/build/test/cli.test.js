import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);

test("init detects the framework and safely wraps an existing build", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "spicytrack-init-"));
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ scripts: { build: "next build" }, dependencies: { next: "latest" } }),
  );
  const cli = new URL("../src/cli.js", import.meta.url);
  const { stdout } = await execute(
    process.execPath,
    [
      cli.pathname,
      "init",
      "--url",
      "https://errors.example.test",
      "--organization",
      "acme",
      "--project",
      "storefront",
    ],
    { cwd },
  );

  const packageJson = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8"));
  const config = JSON.parse(await readFile(path.join(cwd, ".spicytrack.json"), "utf8"));
  assert.equal(packageJson.scripts.build, "spicytrack build -- next build");
  assert.equal(packageJson.devDependencies["@spicytrack/build"], "^0.1.0");
  assert.deepEqual(config.roots, [".next"]);
  assert.equal("token" in config, false);
  assert.match(stdout, /Detected nextjs/);
});

test("a failed wrapped build never attempts an upload", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "spicytrack-build-"));
  await writeFile(
    path.join(cwd, ".spicytrack.json"),
    JSON.stringify({ url: "https://invalid.test", organization: "acme", project: "storefront" }),
  );
  const cli = new URL("../src/cli.js", import.meta.url);
  await assert.rejects(
    execute(
      process.execPath,
      [cli.pathname, "build", "--", process.execPath, "--eval", "process.exit(7)"],
      {
        cwd,
        env: {
          ...process.env,
          SPICYTRACK_RELEASE: "failed-build",
          SPICYTRACK_AUTH_TOKEN: "pat_test",
        },
      },
    ),
    (error) => error.code === 7,
  );
});
