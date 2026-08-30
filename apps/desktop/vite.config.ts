import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { pathAlias } from "./path-aliases";

function vendorChunkName(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }
  if (id.includes("@codemirror") || id.includes("/codemirror/")) {
    return "codemirror";
  }
  if (id.includes("streamdown") || id.includes("@streamdown")) {
    return "streamdown";
  }
  if (id.includes("/motion/") || id.includes("framer-motion")) {
    return "motion";
  }
  if (id.includes("@base-ui/react")) {
    return "base-ui";
  }
  return undefined;
}

export default defineConfig({
  // Electron loads the renderer via file:// (packaged + production); relative asset URLs are required.
  base: "./",
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: pathAlias,
  },
  build: {
    // Electron ships assets locally; skip Rollup's default 500 kB chunk warnings.
    chunkSizeWarningLimit: 10_000,
    reportCompressedSize: false,
    cssMinify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunkName(id);
        },
      },
    },
  },
  logLevel: "warn",
  server: {
    port: 5173,
    strictPort: true,
  },
});
