import { spawn } from "node:child_process";
import { resolve } from "node:path";

const rootDir = process.cwd();
const apiDir = resolve(rootDir, "apps/api");
const webDir = resolve(rootDir, "apps/web");

function run(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });

    child.on("error", rejectPromise);
  });
}

async function main() {
  await run("./node_modules/.bin/nest", ["build"], apiDir);
  await run("node", ["scripts/generate-openapi.mjs"], apiDir);
  await run("./node_modules/.bin/orval", ["--config", "orval.config.ts"], webDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
