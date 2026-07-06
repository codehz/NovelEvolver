import type { RpcTarget } from "capnweb";

import type { ProjectMetadata } from "#shared/project";

import type { ManuscriptHandle } from "./manuscript-rpc";
import type { ResourceLibraryHandle } from "./resource-library-rpc";
import type { WorktreeChangesHandle } from "./worktree-changes-rpc";
import type { WorktreeSearchHandle } from "./worktree-search-rpc";
import type { WorktreeTimelineHandle } from "./worktree-timeline-rpc";

/** Branch info for the HEAD of a project repository. */
export type BranchInfo = {
  /** Branch name, e.g. "main". null if HEAD is detached. */
  name: string | null;
  /** Commit SHA of HEAD. null if the repository has no commits yet. */
  commit: string | null;
};

/** Live RPC handle for a branch-scoped virtual worktree (SQLite-backed in app userData). */
export interface WorktreeHandle extends RpcTarget {
  readonly resources: ResourceLibraryHandle;
  readonly manuscript: ManuscriptHandle;
  readonly search: WorktreeSearchHandle;
  readonly changes: WorktreeChangesHandle;
  readonly timeline: WorktreeTimelineHandle;
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
