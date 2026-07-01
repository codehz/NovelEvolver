import { assertValidResourceRelativePath } from "@shared/resource-library-path";
import type { VirtualWorktree } from "nano-git/worktree/core";

export { assertValidResourceRelativePath } from "@shared/resource-library-path";

/** Worktree-relative directory name for the per-branch resource library. */
export const RESOURCES_DIR = "resources";

/** Maps an RPC path (relative to `resources/`) to a virtual worktree path. */
export function toWorktreePath(relativePath: string): string {
  assertValidResourceRelativePath(relativePath);
  return relativePath === "" ? RESOURCES_DIR : `${RESOURCES_DIR}/${relativePath}`;
}

export function joinWorktreeChild(dirPath: string, name: string): string {
  return dirPath === "" ? name : `${dirPath}/${name}`;
}

export function parentWorktreePath(path: string): string | null {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) {
    return null;
  }
  return path.slice(0, lastSlash);
}

/** Ensures `resources` exists as a directory in the worktree overlay. */
export function ensureResourcesDirectory(worktree: VirtualWorktree): void {
  if (!worktree.exists(RESOURCES_DIR)) {
    worktree.mkdir(RESOURCES_DIR, { recursive: true });
    return;
  }
  const stat = worktree.stat(RESOURCES_DIR);
  if (stat !== null && stat.kind !== "tree") {
    throw new Error(`"${RESOURCES_DIR}" exists but is not a directory.`);
  }
}
