import type { WorktreeHandle } from "@shared/rpc/projects-rpc";
import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

/**
 * Server-side RPC target wrapping a nano-git SQLite-backed virtual worktree.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #worktree: VirtualWorktree;

  constructor(worktree: VirtualWorktree) {
    super();
    this.#worktree = worktree;
  }

  get baseTree(): string {
    return this.#worktree.baseTree;
  }
}
