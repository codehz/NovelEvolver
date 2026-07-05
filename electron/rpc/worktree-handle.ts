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

import { ScmSession } from "../scm/session";
import { ManuscriptHandleImpl } from "./manuscript-handle";
import { ResourceLibraryHandleImpl } from "./resource-library-handle";
import { WorktreeScmHandleImpl } from "./worktree-scm-handle";

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

  constructor(
    worktree: VirtualWorktree,
    objects: ObjectDatabase,
    repo: Repository,
    branchName: string,
    hadExistingDraft: boolean,
  ) {
    super();
    this.#worktree = worktree;
    const session = new ScmSession(worktree, objects, repo, branchName, { hadExistingDraft });
    this.#resources = new ResourceLibraryHandleImpl(worktree, () => {
      session.handleExternalMutation();
    });
    this.#manuscript = new ManuscriptHandleImpl(worktree, () => {
      session.handleExternalMutation();
    });
    this.#scm = new WorktreeScmHandleImpl(session);
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
}
