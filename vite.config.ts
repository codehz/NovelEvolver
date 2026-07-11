import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { pathAlias } from "./path-aliases";

export default defineConfig({
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: pathAlias,
  },
  build: {
    // Electron ships assets locally; skip Rollup's default 500 kB chunk warnings.
    chunkSizeWarningLimit: 10_000,
    reportCompressedSize: false,
    cssMinify: "esbuild",
  },
  logLevel: "warn",
  server: {
    port: 5173,
    strictPort: true,
  },
});
