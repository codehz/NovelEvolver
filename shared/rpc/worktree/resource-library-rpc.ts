import type { RpcTarget } from "capnweb";

import {
  EXTERNAL_IMPORT_MAX_FILE_BYTES,
  type ExternalImportEntry,
  type ExternalImportSkip,
  type ExternalImportSkipReason,
} from "./external-import";
import type { WorktreeNodeIdResult } from "./manuscript-rpc";

/** @deprecated Prefer `EXTERNAL_IMPORT_MAX_FILE_BYTES`. */
export const RESOURCE_IMPORT_MAX_FILE_BYTES = EXTERNAL_IMPORT_MAX_FILE_BYTES;

export type ResourceImportEntry = ExternalImportEntry;
export type ResourceImportSkipReason = ExternalImportSkipReason;
export type ResourceImportSkip = ExternalImportSkip;

export type ResourceImportCreated = {
  nodeId: string;
  relativePath: string;
  kind: "file" | "folder";
};

export type ResourceImportResult = {
  created: ResourceImportCreated[];
  skipped: ResourceImportSkip[];
};

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
