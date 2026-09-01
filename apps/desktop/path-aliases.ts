import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.dirname(fileURLToPath(import.meta.url));

/** Bundler resolve.alias — keep in sync with tsconfig `compilerOptions.paths`. */
export const pathAlias = {
  "#app": path.join(desktopRoot, "src"),
} satisfies Record<string, string>;
