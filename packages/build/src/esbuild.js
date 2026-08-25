import { createUploadRunner } from "./plugin.js";

export function spicyTrackEsbuildPlugin(options = {}) {
  const upload = createUploadRunner(options);
  return {
    name: "spicytrack-sourcemaps",
    setup(build) {
      const outDir = build.initialOptions.outdir ?? "dist";
      build.initialOptions.sourcemap ??= "external";
      build.onEnd(async (result) => {
        if (!result.errors.length) await upload([outDir]);
      });
    },
  };
}

export default spicyTrackEsbuildPlugin;
