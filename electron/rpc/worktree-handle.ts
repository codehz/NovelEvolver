import { RpcTarget } from "capnweb";
import type { Repository } from "nano-git/repository/core";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type {
  ManuscriptHandle,
  ResourceLibraryHandle,
  WorktreeHandle,
} from "#shared/rpc/projects-rpc";
import type { WorktreeScmHandle } from "#shared/rpc/worktree-scm";
import type { WorktreeSearchHandle } from "#shared/rpc/worktree-search";
import type { WorktreeTreeHandle } from "#shared/rpc/worktree-tree";

import { WorktreeSession } from "../worktree/session";
import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";
import { WorktreeScmHandleImpl } from "./worktree-scm-handle";
import { WorktreeSearchHandleImpl } from "./worktree-search-handle";
import { WorktreeTreeHandleImpl } from "./worktree-tree-handle";

/** ObjectDatabase 类型（从 readTreeSnapshot 参数推导） */
type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

/**
 * Server-side RPC target wrapping a nano-git SQLite-backed virtual worktree.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #worktree: VirtualWorktree;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #scm: WorktreeScmHandle;
  readonly #tree: WorktreeTreeHandle;
  readonly #search: WorktreeSearchHandle;

  constructor(
    worktree: VirtualWorktree,
    objects: ObjectDatabase,
    repo: Repository,
    branchName: string,
    hadExistingDraft: boolean,
  ) {
    super();
    this.#worktree = worktree;
    const session = new WorktreeSession(worktree, objects, repo, branchName, { hadExistingDraft });
    this.#resources = new ResourceLibraryHandleImpl(session);
    this.#manuscript = new ManuscriptHandleImpl(session);
    this.#scm = new WorktreeScmHandleImpl(session);
    this.#tree = new WorktreeTreeHandleImpl(session);
    this.#search = new WorktreeSearchHandleImpl(session);
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

  get scm(): WorktreeScmHandle {
    return this.#scm;
  }

  get tree(): WorktreeTreeHandle {
    return this.#tree;
  }

  get search(): WorktreeSearchHandle {
    return this.#search;
  }
}
