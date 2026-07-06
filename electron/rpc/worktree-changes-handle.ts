import { RpcTarget } from "capnweb";

import type {
  Change,
  ChangesSnapshot,
  WorktreeChangesEvent,
  WorktreeChangesHandle,
} from "#shared/rpc/worktree-changes";

import type { WorktreeSession } from "../worktree/session";

export class WorktreeChangesHandleImpl extends RpcTarget implements WorktreeChangesHandle {
  readonly #session: WorktreeSession;

  constructor(session: WorktreeSession) {
    super();
    this.#session = session;
  }

  async subscribe(): Promise<ReadableStream<WorktreeChangesEvent>> {
    return this.#session.subscribeChanges();
  }

  revertChange(changeId: string): ChangesSnapshot {
    // 复用现有的 revertScmChange 逻辑
    const scmSnapshot = this.#session.revertScmChange(changeId);
    // 转换为 ChangesSnapshot
    return this.#convertScmSnapshotToChangesSnapshot(scmSnapshot);
  }

  commit(message: string, author: { name: string; email: string }): ChangesSnapshot {
    // 复用现有的 commitScm 逻辑
    const scmSnapshot = this.#session.commitScm(message, author);
    // 转换为 ChangesSnapshot
    return this.#convertScmSnapshotToChangesSnapshot(scmSnapshot);
  }

  listCommits(maxCount?: number): {
    hash: string;
    shortHash: string;
    message: string;
    authorName: string;
    committedAt: number;
  }[] {
    return this.#session.listBranchCommits(maxCount);
  }

  #convertScmSnapshotToChangesSnapshot(scmSnapshot: {
    revision: number;
    baseTree: string;
    hasChanges: boolean;
    warning: string | null;
    manuscriptChanges: Array<{
      id: string;
      domain: string;
      kind: string;
      entityId: string;
      entityKind: string;
      label: string;
      displayPath: string;
      depth: number;
      stats?: { added: number; removed: number };
      previousLabel?: string;
      previousPath?: string;
    }>;
    resourceChanges: Array<{
      id: string;
      domain: string;
      kind: string;
      entityId: string;
      entityKind: string;
      label: string;
      displayPath: string;
      depth: number;
      stats?: { added: number; removed: number };
      previousLabel?: string;
      previousPath?: string;
    }>;
  }): ChangesSnapshot {
    // 为变更添加 order 字段（按 displayPath 排序）
    const addOrder = (changes: typeof scmSnapshot.manuscriptChanges) => {
      return changes
        .sort((a, b) => a.displayPath.localeCompare(b.displayPath))
        .map((change, index) => ({ ...change, order: index }));
    };

    const manuscriptChangesWithOrder = addOrder(scmSnapshot.manuscriptChanges);
    const resourceChangesWithOrder = addOrder(scmSnapshot.resourceChanges);

    return {
      revision: scmSnapshot.revision,
      baseTree: scmSnapshot.baseTree,
      hasChanges: scmSnapshot.hasChanges,
      warning: scmSnapshot.warning,
      manuscriptChanges: manuscriptChangesWithOrder.map((change) => ({
        ...change,
        domain: change.domain as "manuscript" | "resource",
        kind: change.kind as "create" | "delete" | "rename" | "move" | "reorder" | "content",
        entityKind: change.entityKind as "chapter" | "folder" | "file",
      })) as Change[],
      resourceChanges: resourceChangesWithOrder.map((change) => ({
        ...change,
        domain: change.domain as "manuscript" | "resource",
        kind: change.kind as "create" | "delete" | "rename" | "move" | "reorder" | "content",
        entityKind: change.entityKind as "chapter" | "folder" | "file",
      })) as Change[],
    };
  }
}
