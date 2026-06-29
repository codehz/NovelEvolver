import { defineConfig } from "tsdown/config";

import { pathAlias } from "./path-aliases.ts";

export default defineConfig({
  entry: ["electron/main.ts", "electron/preload.ts"],
  alias: pathAlias,
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
