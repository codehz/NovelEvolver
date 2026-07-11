import type { SHA1 } from "nano-git";

import type { ResourceTreeSnapshot } from "#shared/rpc/worktree/index";

import type {
  ManuscriptNodeCommittedRow,
  ResourceNodeCommittedRow,
  WorktreeRecord,
} from "../../db/repositories/worktree-repo";
import { readTextFromTree } from "../git/diff-utils";
import { createEmptyOutline } from "../manuscript/outline";
import { chapterBodyPath } from "../manuscript/paths";
import { RESOURCE_ROOT_ID } from "../resources/index";
import {
  buildBaseManuscriptSnapshot,
  buildManuscriptSnapshot,
  type ManuscriptSnapshotState,
} from "../snapshots/manuscript";
import { cloneResourceSnapshotState, type ResourceSnapshotState } from "../snapshots/resource";
import {
  cloneManuscriptSnapshotState,
  cloneManuscriptTreeSnapshot,
  cloneResourceTreeSnapshot,
} from "../trees/tree-clone";
import {
  buildManuscriptTreeFromCommittedRows,
  buildManuscriptTreeFromCurrentRows,
  buildResourceTreeFromCommittedRows,
  buildResourceTreeFromCurrentRows,
} from "../trees/tree-from-rows";
import {
  buildResourceSnapshotFromTree,
  manuscriptTreeFromOutline,
  manuscriptTreeToOutline,
} from "../trees/worktree-tree-bridge";
import { readResourceTreeFromTree, resolveBaseTree } from "./helpers";
import { persistState } from "./persistence";
import { recomputeAllChangeStatuses } from "./rebuild";
import { RESOURCES_FILES_DIR, type WorktreeSessionState } from "./state";

export function loadOrSeed(state: WorktreeSessionState): void {
  const record = state.store.getWorktree(state.projectId, state.branchName);
  if (record === null) {
    seedFromBaseCommit(state, state.repo.readBranch(state.branchName));
    return;
  }

  state.baseCommitSha = record.baseCommitSha as SHA1 | null;
  state.revision = record.revision;
  state.warning = record.warning;

  try {
    loadFromStore(state, record);
  } catch (error) {
    seedFromBaseCommit(
      state,
      record.baseCommitSha as SHA1 | null,
      error instanceof Error
        ? `检测到损坏草稿，已按分支基线重建：${error.message}`
        : "检测到损坏草稿，已按分支基线重建。",
    );
  }
}

export function loadFromStore(state: WorktreeSessionState, record: WorktreeRecord): void {
  const manuscriptCurrentRows = state.store.readManuscriptCurrentRows(
    record.projectId,
    record.branchName,
  );
  const manuscriptCommittedRows = state.store.readManuscriptCommittedRows(
    record.projectId,
    record.branchName,
  );
  const resourceCurrentRows = state.store.readResourceCurrentRows(
    record.projectId,
    record.branchName,
  );
  const resourceCommittedRows = state.store.readResourceCommittedRows(
    record.projectId,
    record.branchName,
  );

  state.manuscriptTree = buildManuscriptTreeFromCurrentRows(manuscriptCurrentRows);
  state.baseManuscriptTree = buildManuscriptTreeFromCommittedRows(manuscriptCommittedRows);
  state.resourceTree = buildResourceTreeFromCurrentRows(resourceCurrentRows);
  state.baseResourceTree = buildResourceTreeFromCommittedRows(resourceCommittedRows);

  const currentManuscriptContent = new Map(
    manuscriptCurrentRows
      .filter((row) => row.type === "chapter")
      .map((row) => [row.id, row.content?.toString("utf-8") ?? ""] as const),
  );
  const currentResourceContent = new Map(
    resourceCurrentRows
      .filter((row) => row.type === "file")
      .map((row) => [row.id, row.content?.toString("utf-8") ?? ""] as const),
  );

  state.currentManuscript = buildManuscriptSnapshot(
    manuscriptTreeToOutline(state.manuscriptTree),
    (id) => currentManuscriptContent.get(id) ?? "",
  );
  const currentResourceState = buildResourceSnapshotFromTree(
    state.resourceTree,
    (id) => currentResourceContent.get(id) ?? "",
  );
  state.currentResources = currentResourceState.snapshot;
  state.resourcePathById.clear();
  state.resourceIdByPath.clear();
  for (const [id, path] of currentResourceState.pathById.entries()) {
    state.resourcePathById.set(id, path);
  }
  for (const [path, id] of currentResourceState.idByPath.entries()) {
    state.resourceIdByPath.set(path, id);
  }

  state.baseManuscript = buildBaseManuscriptStateFromCommittedRows(state, manuscriptCommittedRows);
  state.baseResources = buildBaseResourceStateFromCommittedRows(state, resourceCommittedRows);
  recomputeAllChangeStatuses(state);
}

export function seedFromBaseCommit(
  state: WorktreeSessionState,
  baseCommitSha: SHA1 | null,
  warning: string | null = null,
): void {
  state.baseCommitSha = baseCommitSha;
  state.warning = warning;
  state.revision = warning === null ? 0 : state.revision + 1;

  if (baseCommitSha === null) {
    const outline = createEmptyOutline();
    state.manuscriptTree = manuscriptTreeFromOutline(outline);
    state.baseManuscriptTree = cloneManuscriptTreeSnapshot(state.manuscriptTree);
    state.currentManuscript = buildManuscriptSnapshot(outline, () => "");
    state.baseManuscript = cloneManuscriptSnapshotState(state.currentManuscript);
    state.resourceTree = {
      rootId: RESOURCE_ROOT_ID,
      nodes: {
        [RESOURCE_ROOT_ID]: {
          id: RESOURCE_ROOT_ID,
          type: "folder",
          name: "",
          parentId: null,
          childIds: [],
        },
      },
    };
    state.baseResourceTree = cloneResourceTreeSnapshot(state.resourceTree);
    state.currentResources = { entries: new Map() };
    state.baseResources = { entries: new Map() };
    state.resourcePathById.clear();
    state.resourcePathById.set(RESOURCE_ROOT_ID, "");
    state.resourceIdByPath.clear();
    state.resourceIdByPath.set("", RESOURCE_ROOT_ID);
    persistState(state, true);
    return;
  }

  const baseManuscript = buildBaseManuscriptSnapshot(state.objects, resolveBaseTree(state));
  const seededResources = seedResourcesFromBaseTree(state, resolveBaseTree(state));

  state.baseManuscript = baseManuscript;
  state.currentManuscript = cloneManuscriptSnapshotState(baseManuscript);
  state.manuscriptTree = manuscriptTreeFromOutline(baseManuscript.outline);
  state.baseManuscriptTree = cloneManuscriptTreeSnapshot(state.manuscriptTree);
  state.baseResources = cloneResourceSnapshotState(seededResources.snapshot);
  state.currentResources = cloneResourceSnapshotState(seededResources.snapshot);
  state.resourceTree = cloneResourceTreeSnapshot(seededResources.tree);
  state.baseResourceTree = cloneResourceTreeSnapshot(seededResources.tree);
  state.resourcePathById.clear();
  state.resourceIdByPath.clear();
  for (const [id, path] of seededResources.pathById.entries()) {
    state.resourcePathById.set(id, path);
  }
  for (const [path, id] of seededResources.idByPath.entries()) {
    state.resourceIdByPath.set(path, id);
  }
  persistState(state, true);
}

export function seedResourcesFromBaseTree(
  state: WorktreeSessionState,
  baseTree: SHA1,
): {
  tree: ResourceTreeSnapshot;
  snapshot: ResourceSnapshotState;
  pathById: Map<string, string>;
  idByPath: Map<string, string>;
} {
  const tree = readResourceTreeFromTree(state, baseTree);
  const rebuilt = buildResourceSnapshotFromTree(
    tree,
    (id) => readTextFromTree(state.objects, baseTree, `${RESOURCES_FILES_DIR}/${id}.txt`) ?? "",
  );

  return {
    tree,
    snapshot: rebuilt.snapshot,
    pathById: rebuilt.pathById,
    idByPath: rebuilt.idByPath,
  };
}

export function buildBaseManuscriptStateFromCommittedRows(
  state: WorktreeSessionState,
  _rows: readonly ManuscriptNodeCommittedRow[],
): ManuscriptSnapshotState {
  const tree = state.baseManuscriptTree;
  const outline = manuscriptTreeToOutline(tree);
  const baseTree = resolveBaseTree(state);
  return buildManuscriptSnapshot(
    outline,
    (id) => readTextFromTree(state.objects, baseTree, chapterBodyPath(id)) ?? "",
  );
}

export function buildBaseResourceStateFromCommittedRows(
  state: WorktreeSessionState,
  _rows: readonly ResourceNodeCommittedRow[],
): ResourceSnapshotState {
  const baseTree = resolveBaseTree(state);
  return buildResourceSnapshotFromTree(
    state.baseResourceTree,
    (id) => readTextFromTree(state.objects, baseTree, `${RESOURCES_FILES_DIR}/${id}.txt`) ?? "",
  ).snapshot;
}
