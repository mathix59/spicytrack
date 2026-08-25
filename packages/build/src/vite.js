import { createUploadRunner } from "./plugin.js";

export function spicyTrackVitePlugin(options = {}) {
  let root = process.cwd();
  let outDir = "dist";
  const upload = createUploadRunner(options);
  return {
    name: "spicytrack-sourcemaps",
    apply: "build",
    enforce: "post",
    config() {
      return { build: { sourcemap: options.sourcemap ?? "hidden" } };
    },
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    async closeBundle() {
      await upload([outDir], { cwd: root });
    },
  };
}

export default spicyTrackVitePlugin;
