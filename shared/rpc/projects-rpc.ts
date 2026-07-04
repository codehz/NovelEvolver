import type { RpcTarget } from "capnweb";

import type { ProjectMetadata } from "#shared/project";

/** Branch info for the HEAD of a project repository. */
export type BranchInfo = {
  /** Branch name, e.g. "main". null if HEAD is detached. */
  name: string | null;
  /** Commit SHA of HEAD. null if the repository has no commits yet. */
  commit: string | null;
};

export type ResourceNode = {
  name: string;
  type: "file" | "folder";
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

/**
 * File operations under the branch worktree's `resources/` directory.
 *
 * All `path` arguments are relative to that directory; `""` denotes the library root.
 * `readFile` / `writeFile` use UTF-8 text. `unlink` removes files or folders recursively.
 */
export interface ResourceLibraryHandle extends RpcTarget {
  /** List entries in a folder. `path` `""` lists the library root. */
  ls(path: string): ResourceNode[];

  /** Read a file as UTF-8 text. */
  readFile(path: string): string;

  /** Write a file as UTF-8 text (creates parent folders as needed). */
  writeFile(path: string, content: string): void;

  /** Create a folder (and missing parents). */
  createFolder(path: string): void;

  /** Remove a file or folder recursively. Cannot target `""` (the library root). */
  unlink(path: string): void;

  move(from: string, to: string): void;
}

/**
 * Ordered manuscript tree under the branch worktree's `manuscript/` directory.
 *
 * `outline.json` is the source of truth for structure, title, and ordering. Chapter
 * body files are addressed by stable node IDs and are not human-readable paths.
 */
export interface ManuscriptHandle extends RpcTarget {
  getOutline(): ManuscriptOutline;
  createFolder(parentId: string, title: string, index?: number): ManuscriptOutline;
  createChapter(parentId: string, title: string, index?: number): ManuscriptOutline;
  renameNode(id: string, title: string): ManuscriptOutline;
  moveNode(id: string, targetParentId: string, index?: number): ManuscriptOutline;
  deleteNode(id: string): ManuscriptOutline;
  readChapter(id: string): string;
  writeChapter(id: string, content: string): void;
}

/** Live RPC handle for a branch-scoped virtual worktree (SQLite-backed in app userData). */
export interface WorktreeHandle extends RpcTarget {
  /** Baseline tree SHA-1 recorded when the worktree was first created for this branch. */
  readonly baseTree: string;
  readonly resources: ResourceLibraryHandle;
  readonly manuscript: ManuscriptHandle;
  // TODO: design more api
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
