import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { pathAlias } from "./path-aliases";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: pathAlias,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
