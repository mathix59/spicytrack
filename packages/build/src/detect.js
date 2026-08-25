import { access, readFile } from "node:fs/promises";
import path from "node:path";

const FRAMEWORKS = [
  { name: "nextjs", packages: ["next"], roots: [".next"] },
  { name: "nuxt", packages: ["nuxt"], roots: [".output/public"] },
  {
    name: "sveltekit",
    packages: ["@sveltejs/kit"],
    roots: [".svelte-kit/output/client", "build/client"],
  },
  { name: "angular", packages: ["@angular/core"], roots: ["dist"] },
  { name: "vite", packages: ["vite"], roots: ["dist"] },
  { name: "webpack", packages: ["webpack"], roots: ["dist", "build"] },
  { name: "rollup", packages: ["rollup"], roots: ["dist"] },
  { name: "esbuild", packages: ["esbuild"], roots: ["dist", "build"] },
];

async function exists(filename) {
  try {
    await access(filename);
    return true;
  } catch {
    return false;
  }
}

export async function readPackage(cwd) {
  const filename = path.join(cwd, "package.json");
  return JSON.parse(await readFile(filename, "utf8"));
}

export async function detectProject(cwd = process.cwd()) {
  const packageJson = await readPackage(cwd);
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };
  const framework =
    FRAMEWORKS.find((candidate) =>
      candidate.packages.some((packageName) => dependencies[packageName]),
    ) ?? null;
  const packageManager = (await exists(path.join(cwd, "pnpm-lock.yaml")))
    ? "pnpm"
    : (await exists(path.join(cwd, "yarn.lock")))
      ? "yarn"
      : (await exists(path.join(cwd, "bun.lockb"))) || (await exists(path.join(cwd, "bun.lock")))
        ? "bun"
        : "npm";

  return {
    framework: framework?.name ?? "unknown",
    roots: framework?.roots ?? ["dist", "build"],
    packageManager,
    packageJson,
  };
}

export function frameworkRoots(framework) {
  return FRAMEWORKS.find((candidate) => candidate.name === framework)?.roots ?? ["dist", "build"];
}
