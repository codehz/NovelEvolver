import type { RpcTarget } from "capnweb";

import type { ProjectAi } from "#desktop-rpc/ai/handles";
import type { MockAiControlHandle } from "#desktop-rpc/ai/mock-ai-handle";
import type { BranchSummary, ProjectPullResult, ProjectPushResult } from "#domain/git/branch";
import type { ProjectMetadata } from "#domain/project";

import type { BranchWorkspace } from "./branch-workspace";

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
  /**
   * HTTPS remote URL for push (project-scoped, stored in app-state DB).
   * null when not configured.
   */
  readonly remoteUrl: string | null;
  /** Project-scoped AI facade (active / conversations / catalog; shared across branches). */
  readonly ai: ProjectAi;
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
   * Set or clear the project HTTPS remote URL.
   * null / empty clears. Non-empty values are normalized via HTTPS-only rules.
   */
  setRemoteUrl(url: string | null): void;
  /**
   * Set or clear the project custom display name.
   * null / empty clears (UI falls back to path-derived name).
   */
  setDisplayName(name: string | null): void;
  /**
   * Push the current branch to the configured HTTPS remote (same-name refspec).
   * Uses stored Git credentials for the remote host (HTTP Basic).
   * Does not force-push.
   */
  pushCurrentBranch(): Promise<ProjectPushResult>;
  /**
   * Pull (fast-forward only) the current branch from the configured HTTPS remote
   * (same-name refspec). Uses stored Git credentials for the remote host (HTTP Basic).
   *
   * Rejects when the current branch has uncommitted draft changes. On success,
   * realigns that branch's draft worktree to the updated tip.
   * Does not merge, rebase, or force-update local history.
   */
  pullCurrentBranch(): Promise<ProjectPullResult>;
  /**
   * Opens the draft workspace for `name` (branch name). Persisted under key
   * `<project-id>:<branch-name>`. Creates on first use from the branch tip tree,
   * or from an empty tree when the branch has no commits yet; later calls reopen
   * the same entry without rebasing to a moved tip.
   */
  openBranchWorkspace(name: string): BranchWorkspace;
}
