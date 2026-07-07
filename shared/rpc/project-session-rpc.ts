import type { RpcTarget } from "capnweb";

import type { ProjectMetadata } from "#shared/project";

import type { BranchWorkspace } from "./branch-workspace-rpc";

/** Summary for a repository branch tip. */
export type BranchSummary = {
  /** Branch name, e.g. "main". null if HEAD is detached. */
  name: string | null;
  /** Commit SHA of HEAD. null if the repository has no commits yet. */
  commit: string | null;
};

/**
 * RPC handle for an open project's repository session.
 *
 * Returned by {@link WorkspaceService["openProject"]}. The handle stays alive on
 * the server side so that property accessors like `currentBranch` make live queries
 * against the underlying nano-git repository.
 */
export interface ProjectSession extends RpcTarget {
  readonly metadata: ProjectMetadata;
  readonly currentBranch: BranchSummary;
  readonly branches: BranchSummary[];
  checkoutBranch(name: string): void;
  /**
   * Opens the draft workspace for `name` (branch name). Persisted under key
   * `<project-id>:<branch-name>`. Creates on first use from the branch tip tree,
   * or from an empty tree when the branch has no commits yet; later calls reopen
   * the same entry without rebasing to a moved tip.
   */
  openBranchWorkspace(name: string): BranchWorkspace;
}
