import type {
  Change,
  ChangeDomain,
  ChangeKind,
  ChangesSnapshot,
} from "#shared/rpc/worktree-changes";

import { computeStats } from "./diff-utils";
import { computeMinimalReorderedManuscriptIds } from "./manuscript-reorder";
import type { ManuscriptEntry, ManuscriptSnapshotState } from "./snapshot-state";

export type ResourceSnapshotEntry = {
  id: string;
  type: "file" | "folder";
  name: string;
  parentId: string;
  index: number;
  depth: number;
  displayPath: string;
  order: number;
  content: string;
};

export type ResourceSnapshotState = {
  entries: Map<string, ResourceSnapshotEntry>;
};

type BuildChangesSnapshotOptions = {
  revision: number;
  baseTree: string;
  warning: string | null;
  baseManuscript: ManuscriptSnapshotState;
  currentManuscript: ManuscriptSnapshotState;
  baseResources: ResourceSnapshotState;
  currentResources: ResourceSnapshotState;
};

/**
 * 变更跟踪器，负责增量计算变更
 *
 * 设计理念：
 * 1. 只在 dirty 时重新计算变更
 * 2. 缓存上次计算结果，只返回变化的变更
 * 3. 支持增量更新，减少数据传输
 */
export class ChangeTracker {
  #lastBaseManuscript: ManuscriptSnapshotState | null = null;
  #lastCurrentManuscript: ManuscriptSnapshotState | null = null;
  #lastBaseResources: ResourceSnapshotState | null = null;
  #lastCurrentResources: ResourceSnapshotState | null = null;
  #lastChanges: ChangesSnapshot | null = null;

  get lastChanges(): ChangesSnapshot | null {
    return this.#lastChanges;
  }

  /**
   * 计算变更快照
   *
   * 如果 base/current 状态与上次相同，返回缓存结果
   * 否则重新计算并缓存
   */
  computeChanges(options: BuildChangesSnapshotOptions): ChangesSnapshot {
    const {
      revision,
      baseTree,
      warning,
      baseManuscript,
      currentManuscript,
      baseResources,
      currentResources,
    } = options;

    // 检查是否需要重新计算
    if (
      this.#lastBaseManuscript !== null &&
      this.#lastCurrentManuscript !== null &&
      this.#lastBaseResources !== null &&
      this.#lastCurrentResources !== null &&
      this.#isSnapshotStateEqual(this.#lastBaseManuscript, baseManuscript) &&
      this.#isSnapshotStateEqual(this.#lastCurrentManuscript, currentManuscript) &&
      this.#isResourceStateEqual(this.#lastBaseResources, baseResources) &&
      this.#isResourceStateEqual(this.#lastCurrentResources, currentResources)
    ) {
      // 状态未变，返回缓存结果（更新 revision）
      return {
        ...this.#lastChanges!,
        revision,
      };
    }

    // 重新计算变更
    const manuscriptChanges = this.#computeManuscriptChanges(baseManuscript, currentManuscript);
    const resourceChanges = this.#computeResourceChanges(baseResources, currentResources);

    const snapshot: ChangesSnapshot = {
      revision,
      baseTree,
      hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
      warning,
      manuscriptChanges,
      resourceChanges,
    };

    // 缓存结果
    this.#lastBaseManuscript = this.#cloneManuscriptState(baseManuscript);
    this.#lastCurrentManuscript = this.#cloneManuscriptState(currentManuscript);
    this.#lastBaseResources = this.#cloneResourceState(baseResources);
    this.#lastCurrentResources = this.#cloneResourceState(currentResources);
    this.#lastChanges = snapshot;

    return snapshot;
  }

  /**
   * 计算增量变更
   *
   * 比较当前快照与上次快照，返回新增和删除的变更
   */
  computeDelta(
    current: ChangesSnapshot,
    currentRevision: number,
  ): {
    addedChanges: Change[];
    removedChangeIds: string[];
    fromRevision: number;
    toRevision: number;
  } {
    if (this.#lastChanges === null) {
      // 首次计算，返回所有变更
      return {
        addedChanges: [...current.manuscriptChanges, ...current.resourceChanges],
        removedChangeIds: [],
        fromRevision: currentRevision - 1,
        toRevision: currentRevision,
      };
    }

    const previous = this.#lastChanges;

    // 计算新增的变更
    const addedChanges: Change[] = [];
    const removedChangeIds: string[] = [];

    const previousChangeIds = new Set<string>();
    for (const change of previous.manuscriptChanges) {
      previousChangeIds.add(change.id);
    }
    for (const change of previous.resourceChanges) {
      previousChangeIds.add(change.id);
    }

    const currentChangeIds = new Set<string>();
    for (const change of current.manuscriptChanges) {
      currentChangeIds.add(change.id);
      if (!previousChangeIds.has(change.id)) {
        addedChanges.push(change);
      }
    }
    for (const change of current.resourceChanges) {
      currentChangeIds.add(change.id);
      if (!previousChangeIds.has(change.id)) {
        addedChanges.push(change);
      }
    }

    // 计算删除的变更
    for (const changeId of previousChangeIds) {
      if (!currentChangeIds.has(changeId)) {
        removedChangeIds.push(changeId);
      }
    }

    return {
      addedChanges,
      removedChangeIds,
      fromRevision: previous.revision,
      toRevision: currentRevision,
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.#lastBaseManuscript = null;
    this.#lastCurrentManuscript = null;
    this.#lastBaseResources = null;
    this.#lastCurrentResources = null;
    this.#lastChanges = null;
  }

  #computeManuscriptChanges(
    baseManuscript: ManuscriptSnapshotState,
    currentManuscript: ManuscriptSnapshotState,
  ): Change[] {
    const changes: Change[] = [];
    const reorderedManuscriptIds = computeMinimalReorderedManuscriptIds(
      baseManuscript,
      currentManuscript,
    );

    const manuscriptIds = new Set<string>([
      ...baseManuscript.entries.keys(),
      ...currentManuscript.entries.keys(),
    ]);

    for (const id of manuscriptIds) {
      const previous = baseManuscript.entries.get(id) ?? null;
      const current = currentManuscript.entries.get(id) ?? null;
      this.#collectManuscriptChanges(
        changes,
        id,
        previous,
        current,
        reorderedManuscriptIds.has(id),
      );
    }

    // 按 order 和 displayPath 排序
    changes.sort(
      (left, right) =>
        left.order - right.order || left.displayPath.localeCompare(right.displayPath),
    );

    return changes;
  }

  #collectManuscriptChanges(
    changes: Change[],
    id: string,
    previous: ManuscriptEntry | null,
    current: ManuscriptEntry | null,
    reordered: boolean,
  ): void {
    if (previous === null && current !== null) {
      changes.push({
        id: `manuscript:create:${id}`,
        domain: "manuscript" as ChangeDomain,
        kind: "create" as ChangeKind,
        entityId: id,
        entityKind: current.type === "chapter" ? "chapter" : "folder",
        label: current.title,
        displayPath: current.displayPath,
        depth: current.depth,
        order: current.order,
        stats:
          current.type === "chapter" && current.content !== ""
            ? { added: current.content.length, removed: 0 }
            : undefined,
      } as Change);
      return;
    }

    if (previous !== null && current === null) {
      changes.push({
        id: `manuscript:delete:${id}`,
        domain: "manuscript" as ChangeDomain,
        kind: "delete" as ChangeKind,
        entityId: id,
        entityKind: previous.type === "chapter" ? "chapter" : "folder",
        label: previous.title,
        displayPath: previous.displayPath,
        depth: previous.depth,
        order: previous.order,
        stats:
          previous.type === "chapter" && previous.content !== ""
            ? { added: 0, removed: previous.content.length }
            : undefined,
      } as Change);
      return;
    }

    if (previous === null || current === null) {
      return;
    }

    const entityKind = current.type === "chapter" ? "chapter" : "folder";
    const order = current.order;

    if (previous.title !== current.title) {
      changes.push({
        id: `manuscript:rename:${id}`,
        domain: "manuscript" as ChangeDomain,
        kind: "rename" as ChangeKind,
        entityId: id,
        entityKind,
        label: current.title,
        previousLabel: previous.title,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
      } as Change);
    }

    if (previous.parentId !== current.parentId) {
      changes.push({
        id: `manuscript:move:${id}`,
        domain: "manuscript" as ChangeDomain,
        kind: "move" as ChangeKind,
        entityId: id,
        entityKind,
        label: current.title,
        previousPath: previous.displayPath,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
      } as Change);
    } else if (reordered) {
      changes.push({
        id: `manuscript:reorder:${id}`,
        domain: "manuscript" as ChangeDomain,
        kind: "reorder" as ChangeKind,
        entityId: id,
        entityKind,
        label: current.title,
        previousPath: previous.displayPath,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
      } as Change);
    }

    if (current.type === "chapter" && previous.content !== current.content) {
      changes.push({
        id: `manuscript:content:${id}`,
        domain: "manuscript" as ChangeDomain,
        kind: "content" as ChangeKind,
        entityId: id,
        entityKind: "chapter",
        label: current.title,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
        stats: computeStats(previous.content, current.content),
      } as Change);
    }
  }

  #computeResourceChanges(
    baseResources: ResourceSnapshotState,
    currentResources: ResourceSnapshotState,
  ): Change[] {
    const changes: Change[] = [];

    const resourceIds = new Set<string>([
      ...baseResources.entries.keys(),
      ...currentResources.entries.keys(),
    ]);

    for (const id of resourceIds) {
      const previous = baseResources.entries.get(id) ?? null;
      const current = currentResources.entries.get(id) ?? null;
      this.#collectResourceChanges(changes, id, previous, current);
    }

    // 按 order 和 displayPath 排序
    changes.sort(
      (left, right) =>
        left.order - right.order || left.displayPath.localeCompare(right.displayPath),
    );

    return changes;
  }

  #collectResourceChanges(
    changes: Change[],
    id: string,
    previous: ResourceSnapshotEntry | null,
    current: ResourceSnapshotEntry | null,
  ): void {
    if (previous === null && current !== null) {
      changes.push({
        id: `resource:create:${id}`,
        domain: "resource" as ChangeDomain,
        kind: "create" as ChangeKind,
        entityId: id,
        entityKind: current.type === "file" ? "file" : "folder",
        label: current.name,
        displayPath: current.displayPath,
        depth: current.depth,
        order: current.order,
        stats:
          current.type === "file" && current.content !== ""
            ? { added: current.content.length, removed: 0 }
            : undefined,
      } as Change);
      return;
    }

    if (previous !== null && current === null) {
      changes.push({
        id: `resource:delete:${id}`,
        domain: "resource" as ChangeDomain,
        kind: "delete" as ChangeKind,
        entityId: id,
        entityKind: previous.type === "file" ? "file" : "folder",
        label: previous.name,
        displayPath: previous.displayPath,
        depth: previous.depth,
        order: previous.order,
        stats:
          previous.type === "file" && previous.content !== ""
            ? { added: 0, removed: previous.content.length }
            : undefined,
      } as Change);
      return;
    }

    if (previous === null || current === null) {
      return;
    }

    const entityKind = current.type === "file" ? "file" : "folder";
    const order = current.order;

    if (previous.name !== current.name) {
      changes.push({
        id: `resource:rename:${id}`,
        domain: "resource" as ChangeDomain,
        kind: "rename" as ChangeKind,
        entityId: id,
        entityKind,
        label: current.name,
        previousLabel: previous.name,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
      } as Change);
    }

    if (previous.parentId !== current.parentId) {
      changes.push({
        id: `resource:move:${id}`,
        domain: "resource" as ChangeDomain,
        kind: "move" as ChangeKind,
        entityId: id,
        entityKind,
        label: current.name,
        previousPath: previous.displayPath,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
      } as Change);
    }

    if (current.type === "file" && previous.content !== current.content) {
      changes.push({
        id: `resource:content:${id}`,
        domain: "resource" as ChangeDomain,
        kind: "content" as ChangeKind,
        entityId: id,
        entityKind: "file",
        label: current.name,
        displayPath: current.displayPath,
        depth: current.depth,
        order,
        stats: computeStats(previous.content, current.content),
      } as Change);
    }
  }

  #isSnapshotStateEqual(a: ManuscriptSnapshotState, b: ManuscriptSnapshotState): boolean {
    if (a.entries.size !== b.entries.size) {
      return false;
    }
    for (const [id, entryA] of a.entries.entries()) {
      const entryB = b.entries.get(id);
      if (entryB === undefined) {
        return false;
      }
      if (
        entryA.type !== entryB.type ||
        entryA.title !== entryB.title ||
        entryA.parentId !== entryB.parentId ||
        entryA.content !== entryB.content ||
        entryA.displayPath !== entryB.displayPath ||
        entryA.depth !== entryB.depth ||
        entryA.order !== entryB.order
      ) {
        return false;
      }
    }
    return true;
  }

  #isResourceStateEqual(a: ResourceSnapshotState, b: ResourceSnapshotState): boolean {
    if (a.entries.size !== b.entries.size) {
      return false;
    }
    for (const [id, entryA] of a.entries.entries()) {
      const entryB = b.entries.get(id);
      if (entryB === undefined) {
        return false;
      }
      if (
        entryA.type !== entryB.type ||
        entryA.name !== entryB.name ||
        entryA.parentId !== entryB.parentId ||
        entryA.content !== entryB.content ||
        entryA.displayPath !== entryB.displayPath ||
        entryA.depth !== entryB.depth ||
        entryA.order !== entryB.order
      ) {
        return false;
      }
    }
    return true;
  }

  #cloneManuscriptState(state: ManuscriptSnapshotState): ManuscriptSnapshotState {
    return {
      outline: {
        version: state.outline.version,
        rootId: state.outline.rootId,
        nodes: Object.fromEntries(
          Object.entries(state.outline.nodes).map(([id, node]) => [
            id,
            {
              ...node,
              children: node.type === "folder" ? [...node.children] : [],
            },
          ]),
        ),
      },
      entries: new Map(
        [...state.entries.entries()].map(([id, entry]) => [
          id,
          { ...entry, childIds: [...entry.childIds] },
        ]),
      ),
    };
  }

  #cloneResourceState(state: ResourceSnapshotState): ResourceSnapshotState {
    return {
      entries: new Map([...state.entries.entries()].map(([id, entry]) => [id, { ...entry }])),
    };
  }
}
