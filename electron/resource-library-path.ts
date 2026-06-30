import type { VirtualWorktree } from "nano-git/worktree/core";

/** Worktree-relative directory name for the per-branch resource library. */
export const RESOURCES_DIR = "resources";

/**
 * Validates a path relative to the resource library root.
 * `""` is the library root; non-empty paths follow Git-style virtual path rules.
 */
export function assertValidResourceRelativePath(relativePath: string): void {
  if (relativePath === "") {
    return;
  }
  if (relativePath.startsWith("/")) {
    throw new Error(`Path must not start with '/': ${relativePath}`);
  }
  if (relativePath.endsWith("/")) {
    throw new Error(`Path must not end with '/': ${relativePath}`);
  }
  if (relativePath.includes("//")) {
    throw new Error(`Path must not contain consecutive slashes: ${relativePath}`);
  }
  for (const segment of relativePath.split("/")) {
    if (segment === "." || segment === "..") {
      throw new Error(`Path must not contain '.' or '..': ${relativePath}`);
    }
    if (segment === "") {
      throw new Error(`Path must not contain empty segments: ${relativePath}`);
    }
  }
}

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
