import { assertValidResourceRelativePath } from "@novelevolver/domain/resource-library-path";

export {
  assertResourceLibraryFilePath,
  assertResourceLibraryFolderCreatePath,
  assertResourceLibraryListPath,
  assertResourceLibraryMovePaths,
  assertResourceLibraryRemovablePath,
  assertValidResourceRelativePath,
} from "@novelevolver/domain/resource-library-path";

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
