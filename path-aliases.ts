import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Bundler resolve.alias — keep in sync with tsconfig `compilerOptions.paths`. */
export const pathAlias = {
  "#app": path.join(projectRoot, "src"),
  "#shared": path.join(projectRoot, "shared"),
} satisfies Record<string, string>;
