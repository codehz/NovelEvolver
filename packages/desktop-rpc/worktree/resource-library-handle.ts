import type { RpcTarget } from "capnweb";

import type {
  ResourceImportEntry,
  ResourceImportResult,
  WorktreeNodeIdResult,
} from "#domain/worktree/resource-library";

/**
 * File operations under the branch worktree's `resources/` directory.
 *
 * All `path` arguments are relative to that directory; `""` denotes the library root.
 * `getTree` and structure-changing operations return a full metadata snapshot keyed by path.
 * `readFile` / `writeFile` use UTF-8 text. `unlink` removes files or folders recursively.
 */
export interface ResourceLibraryHandle extends RpcTarget {
  /** Create an empty file under `parentId`. */
  createFile(parentId: string, name: string): WorktreeNodeIdResult;

  /** Create a folder under `parentId`. */
  createFolder(parentId: string, name: string): WorktreeNodeIdResult;

  /**
   * Batch-import folders and UTF-8 text files under `targetParentId`.
   *
   * `relativePath` is relative to the target parent (no leading/trailing `/`).
   * Same-name folders merge; same-name files are skipped. Single journal group on success.
   */
  importEntries(
    targetParentId: string,
    entries: readonly ResourceImportEntry[],
  ): ResourceImportResult;

  /** Read a file as UTF-8 text. */
  readFile(id: string): string;

  /** Write a file as UTF-8 text. */
  writeFile(id: string, content: string): void;

  /** Rename a file or folder within its current parent. */
  renameNode(id: string, name: string): void;

  /** Remove a file or folder recursively. */
  deleteNode(id: string): void;

  moveNode(id: string, targetParentId: string): void;
}
