import type { ProjectListItem, ProjectRecord } from "@shared/project";
import type { RpcTarget } from "capnweb";

/** Branch info for the HEAD of a project repository. */
export type BranchInfo = {
  /** Branch name, e.g. "main". null if HEAD is detached. */
  name: string | null;
  /** Commit SHA of HEAD. null if the repository has no commits yet. */
  commit: string | null;
};

/**
 * RPC handle for an open project's repository.
 *
 * Returned by {@link ProjectsService["openProject"]}. The handle stays alive on
 * the server side so that property accessors like `head` make live queries
 * against the underlying nano-git repository.
 */
export interface ProjectHandle extends RpcTarget {
  readonly head: BranchInfo;
}

export type OpenProjectResult = {
  readonly handle: ProjectHandle;
  readonly project: ProjectListItem;
};

export interface ProjectsService extends RpcTarget {
  readonly recents: ProjectListItem[];
  openProjectDialog(): Promise<ProjectRecord | null>;
  createProjectDialog(): Promise<ProjectRecord | null>;
  recordOpen(id: number): ProjectRecord | null;
  removeRecent(id: number): boolean;

  /** Open a project by its database id and return its metadata plus a live RPC handle. */
  openProject(id: number): OpenProjectResult;
}
