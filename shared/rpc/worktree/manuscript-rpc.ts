import type { RpcTarget } from "capnweb";

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

/**
 * Ordered manuscript tree under the branch worktree's `manuscript/` directory.
 *
 * `outline.json` is the source of truth for structure, title, and ordering. Chapter
 * body files are addressed by stable node IDs and are not human-readable paths.
 */
export interface ManuscriptHandle extends RpcTarget {
  createFolder(parentId: string, title: string, index?: number): WorktreeNodeIdResult;
  createChapter(parentId: string, title: string, index?: number): WorktreeNodeIdResult;
  renameNode(id: string, title: string): void;
  moveNode(id: string, targetParentId: string, index?: number): void;
  deleteNode(id: string): void;
  readChapter(id: string): string;
  writeChapter(id: string, content: string): void;
}
