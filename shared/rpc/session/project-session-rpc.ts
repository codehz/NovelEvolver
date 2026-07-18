import type { RpcTarget } from "capnweb";

import type { ProjectMetadata } from "#shared/project";

import type { AiChatHandle, MockAiControlHandle } from "../ai/index";
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
  /** Project-scoped AI chat handle (shared across branches). */
  readonly ai: AiChatHandle;
  /** Returns null when mock AI test controls are disabled in the main process. */
  getMockAiControl(): MockAiControlHandle | null;
  checkoutBranch(name: string): void;
  /**
   * Creates a branch ref at `startCommit` when provided, otherwise at the current
   * HEAD tip. Does **not** checkout — callers should call {@link checkoutBranch}
   * afterwards when switching is desired.
   *
   * Requires a resolvable tip commit (empty repository must commit first unless
   * `startCommit` is supplied). Rejects empty names and existing branch names.
   */
  createBranch(name: string, startCommit?: string): BranchSummary;
  /**
   * Deletes a branch ref and discards that branch's draft worktree (including
   * uncommitted manuscript/resource changes). Rejects the current branch.
   */
  deleteBranch(name: string): void;
  /**
   * Opens the draft workspace for `name` (branch name). Persisted under key
   * `<project-id>:<branch-name>`. Creates on first use from the branch tip tree,
   * or from an empty tree when the branch has no commits yet; later calls reopen
   * the same entry without rebasing to a moved tip.
   */
  openBranchWorkspace(name: string): BranchWorkspace;
}
