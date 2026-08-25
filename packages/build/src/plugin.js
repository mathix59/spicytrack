import { uploadSourceMaps } from "./upload.js";

export function createUploadRunner(options = {}) {
  let running = null;
  return async (roots, runtimeOptions = {}) => {
    if (running) return running;
    running = uploadSourceMaps({
      ...options,
      ...runtimeOptions,
      roots: options.roots ?? roots,
    }).finally(() => {
      running = null;
    });
    return running;
  };
}
