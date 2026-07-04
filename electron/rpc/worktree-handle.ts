import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type {
  ManuscriptHandle,
  ResourceLibraryHandle,
  WorktreeHandle,
} from "#shared/rpc/projects-rpc";

import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";

/**
 * Server-side RPC target wrapping a nano-git SQLite-backed virtual worktree.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #worktree: VirtualWorktree;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;

  constructor(worktree: VirtualWorktree) {
    super();
    this.#worktree = worktree;
    this.#resources = new ResourceLibraryHandleImpl(worktree);
    this.#manuscript = new ManuscriptHandleImpl(worktree);
  }

  get baseTree(): string {
    return this.#worktree.baseTree;
  }

  get resources(): ResourceLibraryHandle {
    return this.#resources;
  }

  get manuscript(): ManuscriptHandle {
    return this.#manuscript;
  }
}
