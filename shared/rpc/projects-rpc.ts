import type { RpcTarget } from "capnweb";

import type { ProjectMetadata } from "#shared/project";

import type { WorktreeChangesHandle } from "./worktree-changes";
import type { WorktreeSearchHandle } from "./worktree-search";

/** Branch info for the HEAD of a project repository. */
export type BranchInfo = {
  /** Branch name, e.g. "main". null if HEAD is detached. */
  name: string | null;
  /** Commit SHA of HEAD. null if the repository has no commits yet. */
  commit: string | null;
};

export type ResourceNodeType = "file" | "folder";

export type ResourceNode = {
  name: string;
  type: ResourceNodeType;
};

export type ResourceFileTreeNode = {
  path: string;
  name: string;
  type: "file";
};

export type ResourceFolderTreeNode = {
  path: string;
  name: string;
  type: "folder";
  children: string[];
};

export type ResourceTreeNode = ResourceFileTreeNode | ResourceFolderTreeNode;

export type ResourceTreeSnapshot = {
  version: 1;
  rootPath: "";
  nodes: Record<string, ResourceTreeNode>;
};

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

/** Live RPC handle for a branch-scoped virtual worktree (SQLite-backed in app userData). */
export interface WorktreeHandle extends RpcTarget {
  readonly resources: ResourceLibraryHandle;
  readonly manuscript: ManuscriptHandle;
  readonly search: WorktreeSearchHandle;
  readonly changes: WorktreeChangesHandle;
}

/**
 * RPC handle for an open project's repository.
 *
 * Returned by {@link ProjectsService["openProject"]}. The handle stays alive on
 * the server side so that property accessors like `head` make live queries
 * against the underlying nano-git repository.
 */
export interface ProjectHandle extends RpcTarget {
  readonly head: BranchInfo;
  readonly branches: BranchInfo[];
  switchBranch(name: string): void;
  /**
   * Opens the virtual worktree for `name` (branch name). Persisted under key
   * `<project-id>:<branch-name>`. Creates on first use from the branch tip tree,
   * or from an empty tree when the branch has no commits yet; later calls reopen
   * the same entry without rebasing to a moved tip.
   */
  openWorktree(name: string): WorktreeHandle;
}

export type ProjectHandleWithMetadata = {
  readonly handle: ProjectHandle;
  readonly metadata: ProjectMetadata;
};

export interface ProjectsService extends RpcTarget {
  readonly recents: ProjectMetadata[];
  openProjectDialog(): Promise<ProjectMetadata | null>;
  createProjectDialog(): Promise<ProjectMetadata | null>;
  recordOpen(id: number): ProjectMetadata | null;
  removeProject(id: number): boolean;

  /** Open a project by its database id and return its metadata plus a live RPC handle. */
  openProject(id: number): ProjectHandleWithMetadata;
}
