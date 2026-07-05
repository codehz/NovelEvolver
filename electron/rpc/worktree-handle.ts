import { RpcTarget } from "capnweb";
import type { Repository } from "nano-git/repository/core";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";

import type {
  ManuscriptHandle,
  ResourceLibraryHandle,
  WorktreeHandle,
} from "#shared/rpc/projects-rpc";
import type { WorktreeScmHandle } from "#shared/rpc/worktree-scm";
import type { WorktreeSearchHandle } from "#shared/rpc/worktree-search";
import type { WorktreeTreeHandle } from "#shared/rpc/worktree-tree";

import { WorktreeSession } from "../worktree/session";
import type { WorktreesStore } from "../worktrees-store";
import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";
import { WorktreeScmHandleImpl } from "./worktree-scm-handle";
import { WorktreeSearchHandleImpl } from "./worktree-search-handle";
import { WorktreeTreeHandleImpl } from "./worktree-tree-handle";

/** ObjectDatabase 类型（从 readTreeSnapshot 参数推导） */
type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

/**
 * Server-side RPC target wrapping a SQLite-backed branch worktree session.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #session: WorktreeSession;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #scm: WorktreeScmHandle;
  readonly #tree: WorktreeTreeHandle;
  readonly #search: WorktreeSearchHandle;

  constructor(
    store: WorktreesStore,
    objects: ObjectDatabase,
    repo: Repository,
    projectId: number,
    branchName: string,
  ) {
    super();
    this.#session = new WorktreeSession(store, objects, repo, projectId, branchName);
    this.#resources = new ResourceLibraryHandleImpl(this.#session);
    this.#manuscript = new ManuscriptHandleImpl(this.#session);
    this.#scm = new WorktreeScmHandleImpl(this.#session);
    this.#tree = new WorktreeTreeHandleImpl(this.#session);
    this.#search = new WorktreeSearchHandleImpl(this.#session);
  }

  get baseTree(): string {
    return this.#session.baseTree;
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
