import { RpcTarget } from "capnweb";

import type { AiChatHandle } from "#shared/rpc/ai-rpc";
import type { BranchWorkspace } from "#shared/rpc/branch-workspace-rpc";
import type { HistoryHandle } from "#shared/rpc/history-rpc";
import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";
import type { WorktreeChangesHandle } from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeSearchHandle } from "#shared/rpc/worktree-search-rpc";

import { BranchAiSession } from "../../ai/branch-ai-session";
import type { WorktreeSession } from "../../worktree/session";
import { AiChatHandleImpl } from "../handles/ai-chat-handle";
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
  readonly #aiSession: BranchAiSession;
  readonly #ai: AiChatHandle;
  readonly #resources: ResourceLibraryHandle;
  readonly #manuscript: ManuscriptHandle;
  readonly #search: WorktreeSearchHandle;
  readonly #changes: WorktreeChangesHandle;
  readonly #history: HistoryHandle;

  constructor(session: WorktreeSession, branchName: string) {
    super();
    this.#session = session;
    this.#aiSession = new BranchAiSession(branchName);
    this.#ai = new AiChatHandleImpl(this.#aiSession);
    this.#resources = new ResourceLibraryHandleImpl(this.#session);
    this.#manuscript = new ManuscriptHandleImpl(this.#session);
    this.#search = new WorktreeSearchHandleImpl(this.#session);
    this.#changes = new WorktreeChangesHandleImpl(this.#session);
    this.#history = new HistoryHandleImpl(this.#session);
  }

  get ai(): AiChatHandle {
    return this.#ai;
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

  [Symbol.dispose](): void {
    this.#aiSession[Symbol.dispose]();
    this.#session[Symbol.dispose]();
  }
}
