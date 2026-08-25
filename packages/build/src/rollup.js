import { createUploadRunner } from "./plugin.js";

export function spicyTrackRollupPlugin(options = {}) {
  const upload = createUploadRunner(options);
  let root = "dist";
  return {
    name: "spicytrack-sourcemaps",
    outputOptions(output) {
      root = output.dir ?? (output.file ? output.file.replace(/\/[^/]+$/, "") : "dist");
      return { ...output, sourcemap: options.sourcemap ?? "hidden" };
    },
    async closeBundle() {
      await upload([root]);
    },
  };
}

export default spicyTrackRollupPlugin;
