import { clampChildIndex, MANUSCRIPT_ROOT_ID } from "../manuscript/outline";
import { RESOURCE_ROOT_ID } from "../resources/index";
import { cloneManuscriptTreeNode, cloneResourceTreeNode } from "../trees/tree-clone";
import { sortResourceChildrenByName } from "../trees/worktree-tree-bridge";
import {
  collectManuscriptSubtreeIds,
  collectResourceSubtreeIds,
  requireManuscriptFolder,
  requireManuscriptNode,
  requireResourceFolder,
  requireResourceNode,
} from "./helpers";
import { rebuildCurrentManuscriptFromTree, rebuildCurrentResourcesFromTree } from "./rebuild";
import type { WorktreeSessionState } from "./state";

export function revertManuscriptChange(
  state: WorktreeSessionState,
  kind: string,
  id: string,
): void {
  switch (kind) {
    case "create":
      deleteManuscriptNodeFromCurrent(state, id);
      return;
    case "delete":
      restoreManuscriptSubtreeFromBase(state, id);
      return;
    case "rename":
      renameManuscriptToBase(state, id);
      return;
    case "move":
    case "reorder":
      moveManuscriptToBase(state, id);
      return;
    case "content":
      restoreManuscriptContentFromBase(state, id);
      return;
    default:
      throw new Error(`Unsupported manuscript change kind: ${kind}`);
  }
}

export function revertResourceChange(state: WorktreeSessionState, kind: string, id: string): void {
  switch (kind) {
    case "create":
      deleteResourceNodeFromCurrent(state, id);
      return;
    case "delete":
      restoreResourceSubtreeFromBase(state, id);
      return;
    case "rename":
      renameResourceToBase(state, id);
      return;
    case "move":
      moveResourceToBase(state, id);
      return;
    case "content":
      restoreResourceContentFromBase(state, id);
      return;
    default:
      throw new Error(`Unsupported resource change kind: ${kind}`);
  }
}

export function restoreManuscriptSubtreeFromBase(state: WorktreeSessionState, id: string): void {
  if (state.currentManuscript.entries.has(id)) {
    return;
  }
  ensureCurrentManuscriptAncestorExists(
    state,
    state.baseManuscript.entries.get(id)?.parentId ?? null,
  );
  const contentById = new Map<string, string>();
  const cloneSubtree = (nodeId: string): void => {
    const baseNode = state.baseManuscriptTree.nodes[nodeId];
    if (baseNode === undefined) {
      throw new Error(`Base manuscript node does not exist: ${nodeId}`);
    }
    state.manuscriptTree.nodes[nodeId] = cloneManuscriptTreeNode(baseNode);
    if (baseNode.type === "chapter") {
      contentById.set(nodeId, state.baseManuscript.entries.get(nodeId)?.content ?? "");
    }
    if (baseNode.type === "folder") {
      baseNode.childIds.forEach(cloneSubtree);
    }
  };
  cloneSubtree(id);
  const parentId = state.baseManuscript.entries.get(id)?.parentId ?? MANUSCRIPT_ROOT_ID;
  const parent = requireManuscriptFolder(state, parentId);
  const baseIndex = state.baseManuscript.entries.get(id)?.index ?? parent.childIds.length;
  if (!parent.childIds.includes(id)) {
    parent.childIds.splice(clampChildIndex(baseIndex, parent.childIds.length), 0, id);
  }
  rebuildCurrentManuscriptFromTree(state, contentById);
}

export function ensureCurrentManuscriptAncestorExists(
  state: WorktreeSessionState,
  parentId: string | null,
): void {
  if (parentId === null || parentId === MANUSCRIPT_ROOT_ID) {
    return;
  }
  if (state.manuscriptTree.nodes[parentId] !== undefined) {
    return;
  }
  restoreManuscriptSubtreeFromBase(state, parentId);
}

export function renameManuscriptToBase(state: WorktreeSessionState, id: string): void {
  const node = requireManuscriptNode(state, id);
  const baseNode = state.baseManuscriptTree.nodes[id];
  if (baseNode === undefined) {
    throw new Error(`Base manuscript node does not exist: ${id}`);
  }
  node.title = baseNode.title;
  rebuildCurrentManuscriptFromTree(state);
}

export function moveManuscriptToBase(state: WorktreeSessionState, id: string): void {
  const entry = state.baseManuscript.entries.get(id);
  if (entry === undefined) {
    throw new Error(`Base manuscript node does not exist: ${id}`);
  }
  ensureCurrentManuscriptAncestorExists(state, entry.parentId);
  const node = requireManuscriptNode(state, id);
  const sourceParent = requireManuscriptFolder(state, node.parentId ?? "");
  sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
  const targetParent = requireManuscriptFolder(state, entry.parentId);
  targetParent.childIds.splice(clampChildIndex(entry.index, targetParent.childIds.length), 0, id);
  node.parentId = targetParent.id;
  rebuildCurrentManuscriptFromTree(state);
}

export function restoreManuscriptContentFromBase(state: WorktreeSessionState, id: string): void {
  const entry = state.currentManuscript.entries.get(id);
  const baseEntry = state.baseManuscript.entries.get(id);
  if (entry === undefined || baseEntry === undefined) {
    throw new Error(`Manuscript chapter does not exist in base/current: ${id}`);
  }
  entry.content = baseEntry.content;
}

export function restoreResourceSubtreeFromBase(state: WorktreeSessionState, id: string): void {
  if (state.currentResources.entries.has(id)) {
    return;
  }
  ensureCurrentResourceAncestorExists(state, state.baseResources.entries.get(id)?.parentId ?? null);
  const contentById = new Map<string, string>();
  const cloneSubtree = (nodeId: string): void => {
    const baseNode = state.baseResourceTree.nodes[nodeId];
    if (baseNode === undefined) {
      throw new Error(`Base resource node does not exist: ${nodeId}`);
    }
    state.resourceTree.nodes[nodeId] = cloneResourceTreeNode(baseNode);
    if (baseNode.type === "file") {
      contentById.set(nodeId, state.baseResources.entries.get(nodeId)?.content ?? "");
    }
    if (baseNode.type === "folder") {
      baseNode.childIds.forEach(cloneSubtree);
    }
  };
  cloneSubtree(id);
  const parentId = state.baseResources.entries.get(id)?.parentId ?? RESOURCE_ROOT_ID;
  const parent = requireResourceFolder(state, parentId);
  const baseIndex = state.baseResources.entries.get(id)?.index ?? parent.childIds.length;
  if (!parent.childIds.includes(id)) {
    parent.childIds.splice(clampChildIndex(baseIndex, parent.childIds.length), 0, id);
  }
  rebuildCurrentResourcesFromTree(state, contentById);
}

export function ensureCurrentResourceAncestorExists(
  state: WorktreeSessionState,
  parentId: string | null,
): void {
  if (parentId === null || parentId === RESOURCE_ROOT_ID) {
    return;
  }
  if (state.resourceTree.nodes[parentId] !== undefined) {
    return;
  }
  restoreResourceSubtreeFromBase(state, parentId);
}

export function renameResourceToBase(state: WorktreeSessionState, id: string): void {
  const node = requireResourceNode(state, id);
  const baseNode = state.baseResourceTree.nodes[id];
  if (baseNode === undefined) {
    throw new Error(`Base resource node does not exist: ${id}`);
  }
  node.name = baseNode.name;
  const parentId = node.parentId;
  if (parentId !== null) {
    sortResourceChildrenByName(state.resourceTree, parentId);
  }
  rebuildCurrentResourcesFromTree(state);
}

export function moveResourceToBase(state: WorktreeSessionState, id: string): void {
  const entry = state.baseResources.entries.get(id);
  if (entry === undefined) {
    throw new Error(`Base resource node does not exist: ${id}`);
  }
  ensureCurrentResourceAncestorExists(state, entry.parentId);
  const node = requireResourceNode(state, id);
  const sourceParent = requireResourceFolder(state, node.parentId ?? "");
  sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
  const targetParent = requireResourceFolder(state, entry.parentId);
  targetParent.childIds.splice(clampChildIndex(entry.index, targetParent.childIds.length), 0, id);
  node.parentId = targetParent.id;
  rebuildCurrentResourcesFromTree(state);
}

export function restoreResourceContentFromBase(state: WorktreeSessionState, id: string): void {
  const entry = state.currentResources.entries.get(id);
  const baseEntry = state.baseResources.entries.get(id);
  if (entry === undefined || baseEntry === undefined) {
    throw new Error(`Resource file does not exist in base/current: ${id}`);
  }
  entry.content = baseEntry.content;
}

export function deleteManuscriptNodeFromCurrent(state: WorktreeSessionState, id: string): void {
  if (id === MANUSCRIPT_ROOT_ID) {
    throw new Error("Cannot delete the manuscript root.");
  }
  const node = requireManuscriptNode(state, id);
  const parent = requireManuscriptFolder(state, node.parentId ?? "");
  parent.childIds = parent.childIds.filter((childId) => childId !== id);
  for (const subtreeId of collectManuscriptSubtreeIds(state, id)) {
    delete state.manuscriptTree.nodes[subtreeId];
  }
  rebuildCurrentManuscriptFromTree(state);
}

export function deleteResourceNodeFromCurrent(state: WorktreeSessionState, id: string): void {
  if (id === RESOURCE_ROOT_ID) {
    throw new Error("Cannot delete the resource library root.");
  }
  const node = requireResourceNode(state, id);
  const parent = requireResourceFolder(state, node.parentId ?? "");
  parent.childIds = parent.childIds.filter((childId) => childId !== id);
  for (const subtreeId of collectResourceSubtreeIds(state, id)) {
    delete state.resourceTree.nodes[subtreeId];
  }
  rebuildCurrentResourcesFromTree(state);
}
