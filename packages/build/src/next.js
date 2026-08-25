import { SpicyTrackWebpackPlugin } from "./webpack.js";

export function withSpicyTrack(nextConfig = {}, options = {}) {
  const previousWebpack = nextConfig.webpack;
  return {
    ...nextConfig,
    webpack(config, context) {
      const updated = previousWebpack ? previousWebpack(config, context) : config;
      if (!context.dev && !context.isServer) {
        updated.plugins.push(new SpicyTrackWebpackPlugin({ ...options, roots: [".next"] }));
      }
      return updated;
    },
  };
}

export default withSpicyTrack;
