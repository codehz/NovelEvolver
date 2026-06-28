import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  format: "cjs",
  platform: "node",
  target: "es2022",
  outDir: "dist-electron",
  root: "electron",
  fixedExtension: false,
  tsconfig: "tsconfig.json",
  clean: true,
  dts: false,
  deps: {
    neverBundle: ["electron"],
  },
});
