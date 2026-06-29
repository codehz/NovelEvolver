import type { ProjectListItem, ProjectRecord } from "@shared/project";

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
export interface ProjectHandle {
  readonly head: BranchInfo;
}

export interface ProjectsService {
  readonly recents: ProjectListItem[];
  getRecent(id: number): Promise<ProjectListItem | null>;
  openProjectDialog(): Promise<ProjectRecord | null>;
  createProjectDialog(): Promise<ProjectRecord | null>;
  recordOpen(id: number): Promise<ProjectRecord | null>;
  removeRecent(id: number): Promise<boolean>;

  /** Open a project by its database id and return a live RPC handle. */
  openProject(id: number): Promise<ProjectHandle>;
}
