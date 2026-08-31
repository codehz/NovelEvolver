import type { WorktreeSession } from "@novelevolver/worktree";
import { RpcTarget } from "capnweb";

import type { BranchWorkspace } from "#desktop-rpc/session";
import type { HistoryHandle } from "#desktop-rpc/worktree";
import type { ManuscriptHandle } from "#desktop-rpc/worktree";
import type { ResourceLibraryHandle } from "#desktop-rpc/worktree";
import type { WorktreeChangesHandle } from "#desktop-rpc/worktree";
import type { WorktreeSearchHandle } from "#desktop-rpc/worktree";
import type { WorktreeTransferInput, WorktreeTransferResult } from "#domain/worktree";

import { HistoryHandleImpl } from "../handles/history-handle";
import { ManuscriptHandleImpl } from "../handles/manuscript-handle";
import { ResourceLibraryHandleImpl } from "../handles/resource-library-handle";
import { WorktreeChangesHandleImpl } from "../handles/worktree-changes-handle";
import { WorktreeSearchHandleImpl } from "../handles/worktree-search-handle";

/**
 * Server-side RPC target wrapping a SQLite-backed branch worktree session.
 */
export class BranchWorkspaceImpl extends RpcTarget implements BranchWorkspace {
  readonly #session: WorktreeSession;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #search: WorktreeSearchHandle;
  readonly #changes: WorktreeChangesHandle;
  readonly #history: HistoryHandle;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
    this.#resources = new ResourceLibraryHandleImpl(this.#session);
    this.#manuscript = new ManuscriptHandleImpl(this.#session);
    this.#search = new WorktreeSearchHandleImpl(this.#session);
    this.#changes = new WorktreeChangesHandleImpl(this.#session);
    this.#history = new HistoryHandleImpl(this.#session);
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

  get history(): HistoryHandle {
    return this.#history;
  }

  transferNode(input: WorktreeTransferInput): WorktreeTransferResult {
    return this.#session.transferNode(input);
  }

  [Symbol.dispose](): void {
    this.#session[Symbol.dispose]();
  }
}
