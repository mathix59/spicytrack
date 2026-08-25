import { createUploadRunner } from "./plugin.js";

export class SpicyTrackWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
    this.upload = createUploadRunner(options);
  }

  apply(compiler) {
    if (!compiler.options.devtool) compiler.options.devtool = "hidden-source-map";
    compiler.hooks.afterEmit.tapPromise("SpicyTrackSourceMaps", async () => {
      const outputPath = compiler.options.output?.path;
      await this.upload(outputPath ? [outputPath] : ["dist"]);
    });
  }
}

export default SpicyTrackWebpackPlugin;
