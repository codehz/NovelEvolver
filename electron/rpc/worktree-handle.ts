import { RpcTarget } from "capnweb";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type {
  ManuscriptHandle,
  ResourceLibraryHandle,
  WorktreeHandle,
} from "#shared/rpc/projects-rpc";
import type { WorktreeDiffHandle } from "#shared/rpc/worktree-diff";

import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";
import { WorktreeDiffHandleImpl } from "./worktree-diff-handle";

/** ObjectDatabase 类型（从 readTreeSnapshot 参数推导） */
type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

/**
 * Server-side RPC target wrapping a nano-git SQLite-backed virtual worktree.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #worktree: VirtualWorktree;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #diff: WorktreeDiffHandle;

  constructor(worktree: VirtualWorktree, objects: ObjectDatabase) {
    super();
    this.#worktree = worktree;
    this.#resources = new ResourceLibraryHandleImpl(worktree);
    this.#manuscript = new ManuscriptHandleImpl(worktree);
    this.#diff = new WorktreeDiffHandleImpl(worktree, objects, this.#manuscript);
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

  get diff(): WorktreeDiffHandle {
    return this.#diff;
  }
}
