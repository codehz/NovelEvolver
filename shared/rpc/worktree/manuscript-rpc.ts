import type { RpcTarget } from "capnweb";

import type { ExternalImportEntry, ExternalImportSkip } from "./external-import";

export type ManuscriptNodeType = "folder" | "chapter";

export type ManuscriptFolderNode = {
  id: string;
  type: "folder";
  title: string;
  children: string[];
};

export type ManuscriptChapterNode = {
  id: string;
  type: "chapter";
  title: string;
};

export type ManuscriptNode = ManuscriptFolderNode | ManuscriptChapterNode;

export type ManuscriptOutline = {
  version: 1;
  rootId: "root";
  nodes: Record<string, ManuscriptNode>;
};

export type WorktreeNodeIdResult = {
  nodeId: string;
};

export type ManuscriptImportCreated = {
  nodeId: string;
  relativePath: string;
  kind: "chapter" | "folder";
};

export type ManuscriptImportResult = {
  created: ManuscriptImportCreated[];
  skipped: ExternalImportSkip[];
};

/**
 * Ordered manuscript tree under the branch worktree's `manuscript/` directory.
 *
 * `outline.json` is the source of truth for structure, title, and ordering. Chapter
 * body files are addressed by stable node IDs and are not human-readable paths.
 */
export interface ManuscriptHandle extends RpcTarget {
  createFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult;
  createChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult;
  /**
   * Batch-import folders and UTF-8 text files as manuscript folders/chapters under
   * `targetParentId`.
   *
   * Wire `file` entries become chapters. `index` is the continuous insertion start
   * for top-level entries relative to the target parent (omit = append). Nested
   * children append inside newly created folders. Always creates new nodes (duplicate
   * titles allowed). Single journal group on success.
   */
  importEntries(
    targetParentId: string,
    entries: readonly ExternalImportEntry[],
    index?: number,
  ): ManuscriptImportResult;
  renameNode(id: string, title: string): void;
  moveNode(id: string, targetParentId: string, index?: number): void;
  deleteNode(id: string): void;
  readChapter(id: string): string;
  writeChapter(id: string, content: string): void;
}
