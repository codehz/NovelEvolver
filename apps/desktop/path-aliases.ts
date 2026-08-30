import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.dirname(path.dirname(desktopRoot));

/** Bundler resolve.alias — keep in sync with tsconfig `compilerOptions.paths`. */
export const pathAlias = {
  "#app": path.join(desktopRoot, "src"),
  "#shared": path.join(repoRoot, "packages/shared"),
  "#workbench": path.join(desktopRoot, "src/features/project-workbench"),
} satisfies Record<string, string>;
