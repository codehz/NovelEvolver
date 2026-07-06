import { RpcTarget } from "capnweb";
import type { Repository } from "nano-git/repository/core";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";

import type {
  ManuscriptHandle,
  ResourceLibraryHandle,
  WorktreeHandle,
} from "#shared/rpc/projects-rpc";
import type { WorktreeChangesHandle } from "#shared/rpc/worktree-changes";
import type { WorktreeSearchHandle } from "#shared/rpc/worktree-search";

import type { WorktreeRepository } from "../db/repositories/worktree-repo";
import { WorktreeSession } from "../worktree/session";
import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";
import { WorktreeChangesHandleImpl } from "./worktree-changes-handle";
import { WorktreeSearchHandleImpl } from "./worktree-search-handle";

/** ObjectDatabase 类型（从 readTreeSnapshot 参数推导） */
type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

/**
 * Server-side RPC target wrapping a SQLite-backed branch worktree session.
 */
export class WorktreeHandleImpl extends RpcTarget implements WorktreeHandle {
  readonly #session: WorktreeSession;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #search: WorktreeSearchHandle;
  readonly #changes: WorktreeChangesHandle;

  constructor(
    store: WorktreeRepository,
    objects: ObjectDatabase,
    repo: Repository,
    projectId: number,
    branchName: string,
  ) {
    super();
    this.#session = new WorktreeSession(store, objects, repo, projectId, branchName);
    this.#resources = new ResourceLibraryHandleImpl(this.#session);
    this.#manuscript = new ManuscriptHandleImpl(this.#session);
    this.#search = new WorktreeSearchHandleImpl(this.#session);
    this.#changes = new WorktreeChangesHandleImpl(this.#session);
  }

  get resources(): ResourceLibraryHandle {
    return this.#resources;
  }

  get manuscript(): ManuscriptHandle {
    return this.#manuscript;
  }

  get search(): WorktreeSearchHandle {
    return this.#search;
  }

  get changes(): WorktreeChangesHandle {
    return this.#changes;
  }
}
