import { readFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const packageVersion = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"),
).version;

export default defineConfig({
  envDir: path.resolve(import.meta.dirname, '../..'),
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
