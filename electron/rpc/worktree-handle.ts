import type { ResourceLibraryHandle, WorktreeHandle } from "@shared/rpc/projects-rpc";
import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import { ResourceLibraryHandleImpl } from "./resource-library-handle";

/**
 * Server-side RPC target wrapping a nano-git SQLite-backed virtual worktree.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #worktree: VirtualWorktree;
  readonly #resources: ResourceLibraryHandle;

  constructor(worktree: VirtualWorktree) {
    super();
    this.#worktree = worktree;
    this.#resources = new ResourceLibraryHandleImpl(worktree);
  }

  get baseTree(): string {
    return this.#worktree.baseTree;
  }

  get resources(): ResourceLibraryHandle {
    return this.#resources;
  }
}
