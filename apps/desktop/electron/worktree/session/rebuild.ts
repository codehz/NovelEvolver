import type { FileChangeStatus } from "#domain/worktree";

import { computeMinimalReorderedManuscriptIds } from "../journal/manuscript-reorder";
import { buildManuscriptSnapshot } from "../snapshots/manuscript";
import type { ManuscriptEntry } from "../snapshots/manuscript";
import type { ResourceSnapshotEntry } from "../snapshots/resource";
import { refreshAllFolderChangeStatuses } from "../trees/change-status";
import {
  buildResourceSnapshotFromTree,
  clearChangeStatuses,
  manuscriptTreeToOutline,
} from "../trees/worktree-tree-bridge";
import type { WorktreeSessionState } from "./state";

export function rebuildCurrentManuscriptFromTree(
  state: WorktreeSessionState,
  contentOverrides?: ReadonlyMap<string, string>,
): void {
  const previousContent = new Map(
    [...state.currentManuscript.entries.entries()].map(
      ([id, entry]) => [id, entry.content] as const,
    ),
  );
  for (const [id, content] of contentOverrides ?? []) {
    previousContent.set(id, content);
  }
  state.currentManuscript = buildManuscriptSnapshot(
    manuscriptTreeToOutline(state.manuscriptTree),
    (id) => previousContent.get(id) ?? "",
  );
}

export function rebuildCurrentResourcesFromTree(
  state: WorktreeSessionState,
  contentOverrides?: ReadonlyMap<string, string>,
): void {
  const previousContent = new Map(
    [...state.currentResources.entries.entries()].map(
      ([id, entry]) => [id, entry.content] as const,
    ),
  );
  for (const [id, content] of contentOverrides ?? []) {
    previousContent.set(id, content);
  }
  const rebuilt = buildResourceSnapshotFromTree(
    state.resourceTree,
    (id) => previousContent.get(id) ?? "",
  );
  state.currentResources = rebuilt.snapshot;
  state.resourcePathById.clear();
  state.resourceIdByPath.clear();
  for (const [id, path] of rebuilt.pathById.entries()) {
    state.resourcePathById.set(id, path);
  }
  for (const [path, id] of rebuilt.idByPath.entries()) {
    state.resourceIdByPath.set(path, id);
  }
}

export function recomputeAllChangeStatuses(state: WorktreeSessionState): void {
  clearChangeStatuses(state.manuscriptTree.nodes);
  clearChangeStatuses(state.resourceTree.nodes);
  const reorderedManuscriptIds = computeMinimalReorderedManuscriptIds(
    state.baseManuscript,
    state.currentManuscript,
  );

  for (const [id, entry] of state.currentManuscript.entries.entries()) {
    const node = state.manuscriptTree.nodes[id];
    if (node === undefined) {
      continue;
    }
    const baseEntry = state.baseManuscript.entries.get(id);
    node.changeStatus = resolveManuscriptChangeStatus(
      state,
      entry,
      baseEntry,
      reorderedManuscriptIds.has(id),
    );
  }
  refreshAllFolderChangeStatuses(state.manuscriptTree);

  for (const [id, entry] of state.currentResources.entries.entries()) {
    const node = state.resourceTree.nodes[id];
    if (node === undefined) {
      continue;
    }
    const baseEntry = state.baseResources.entries.get(id);
    node.changeStatus = resolveResourceChangeStatus(state, entry, baseEntry);
  }
  refreshAllFolderChangeStatuses(state.resourceTree);
}

export function resolveManuscriptChangeStatus(
  state: WorktreeSessionState,
  current: ManuscriptEntry,
  base: ManuscriptEntry | undefined,
  reordered: boolean,
): FileChangeStatus | undefined {
  if (base === undefined) {
    return "added";
  }
  if (
    current.title !== base.title ||
    current.parentId !== base.parentId ||
    reordered ||
    (current.type === "chapter" && current.content !== base.content)
  ) {
    return "modified";
  }
  return undefined;
}

export function resolveResourceChangeStatus(
  state: WorktreeSessionState,
  current: ResourceSnapshotEntry,
  base: ResourceSnapshotEntry | undefined,
): FileChangeStatus | undefined {
  if (base === undefined) {
    return "added";
  }
  if (
    current.name !== base.name ||
    current.parentId !== base.parentId ||
    (current.type === "file" && current.content !== base.content)
  ) {
    return "modified";
  }
  return undefined;
}
