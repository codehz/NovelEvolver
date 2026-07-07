import type { WorktreeNodeIdResult } from "#shared/rpc/manuscript-rpc";

import { RESOURCE_ROOT_ID } from "../resources/index";
import {
  normalizeResourceNodeName,
  sortResourceChildrenByName,
} from "../trees/worktree-tree-bridge";
import {
  assertResourceSiblingNameAvailable,
  collectResourceSubtreeIds,
  createResourceId,
  isResourceDescendant,
  requireResourceFolder,
  requireResourceJournalEntry,
  requireResourceNode,
} from "./helpers";
import { persistAndEmit } from "./persistence";
import { rebuildCurrentResourcesFromTree } from "./rebuild";
import { deleteResourceNodeFromCurrent } from "./revert";
import type { WorktreeSessionState } from "./state";

export function createResourceFile(
  state: WorktreeSessionState,
  parentId: string,
  name: string,
): WorktreeNodeIdResult {
  const parent = requireResourceFolder(state, parentId);
  const normalizedName = normalizeResourceNodeName(name);
  assertResourceSiblingNameAvailable(state, parent.id, normalizedName);
  const nodeId = createResourceId(state);
  state.resourceTree.nodes[nodeId] = {
    id: nodeId,
    type: "file",
    name: normalizedName,
    parentId,
    childIds: [],
  };
  parent.childIds.push(nodeId);
  sortResourceChildrenByName(state.resourceTree, parent.id);
  rebuildCurrentResourcesFromTree(state, new Map([[nodeId, ""]]));
  const entry = requireResourceJournalEntry(state, nodeId);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "创建文件",
    groupKey: null,
    operations: [
      {
        kind: "create",
        domain: "resource",
        entityId: nodeId,
        entityKind: "file",
        label: entry.name,
        displayPath: entry.displayPath,
        afterContent: entry.content,
      },
    ],
  });
  return { nodeId };
}

export function createResourceFolder(
  state: WorktreeSessionState,
  parentId: string,
  name: string,
): WorktreeNodeIdResult {
  const parent = requireResourceFolder(state, parentId);
  const normalizedName = normalizeResourceNodeName(name);
  assertResourceSiblingNameAvailable(state, parent.id, normalizedName);
  const nodeId = createResourceId(state);
  state.resourceTree.nodes[nodeId] = {
    id: nodeId,
    type: "folder",
    name: normalizedName,
    parentId,
    childIds: [],
  };
  parent.childIds.push(nodeId);
  sortResourceChildrenByName(state.resourceTree, parent.id);
  rebuildCurrentResourcesFromTree(state);
  const entry = requireResourceJournalEntry(state, nodeId);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "创建文件夹",
    groupKey: null,
    operations: [
      {
        kind: "create",
        domain: "resource",
        entityId: nodeId,
        entityKind: "folder",
        label: entry.name,
        displayPath: entry.displayPath,
      },
    ],
  });
  return { nodeId };
}

export function renameResourceNode(state: WorktreeSessionState, id: string, name: string): void {
  if (id === RESOURCE_ROOT_ID) {
    throw new Error("Cannot rename the resource library root.");
  }
  const node = requireResourceNode(state, id);
  const parentId = node.parentId;
  if (parentId === null) {
    throw new Error(`Resource node has no parent: ${id}`);
  }
  const normalizedName = normalizeResourceNodeName(name);
  if (node.name === normalizedName) {
    return;
  }
  const previous = requireResourceJournalEntry(state, id);
  assertResourceSiblingNameAvailable(state, parentId, normalizedName, id);
  node.name = normalizedName;
  sortResourceChildrenByName(state.resourceTree, parentId);
  rebuildCurrentResourcesFromTree(state);
  const current = requireResourceJournalEntry(state, id);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "重命名",
    groupKey: null,
    operations: [
      {
        kind: "rename",
        domain: "resource",
        entityId: id,
        entityKind: current.type,
        label: current.name,
        displayPath: current.displayPath,
        previousLabel: previous.name,
        previousPath: previous.displayPath,
        beforeContent: previous.type === "file" ? previous.content : null,
        afterContent: current.type === "file" ? current.content : null,
      },
    ],
  });
}

export function moveResourceNode(
  state: WorktreeSessionState,
  id: string,
  targetParentId: string,
): void {
  if (id === RESOURCE_ROOT_ID) {
    throw new Error("Cannot move the resource library root.");
  }
  const node = requireResourceNode(state, id);
  if (
    node.type === "folder" &&
    (targetParentId === id || isResourceDescendant(state, id, targetParentId))
  ) {
    throw new Error("Cannot move a folder into itself or one of its descendants.");
  }
  if (node.parentId === targetParentId) {
    throw new Error("Node is already under the target folder.");
  }
  const previous = requireResourceJournalEntry(state, id);
  const sourceParent = requireResourceFolder(state, node.parentId ?? "");
  const targetParent = requireResourceFolder(state, targetParentId);
  assertResourceSiblingNameAvailable(state, targetParentId, node.name);
  sourceParent.childIds = sourceParent.childIds.filter((childId) => childId !== id);
  targetParent.childIds.push(id);
  node.parentId = targetParent.id;
  sortResourceChildrenByName(state.resourceTree, sourceParent.id);
  sortResourceChildrenByName(state.resourceTree, targetParent.id);
  rebuildCurrentResourcesFromTree(state);
  const current = requireResourceJournalEntry(state, id);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "移动",
    groupKey: null,
    operations: [
      {
        kind: "move",
        domain: "resource",
        entityId: id,
        entityKind: current.type,
        label: current.name,
        displayPath: current.displayPath,
        previousPath: previous.displayPath,
        beforeContent: previous.type === "file" ? previous.content : null,
        afterContent: current.type === "file" ? current.content : null,
      },
    ],
  });
}

export function deleteResourceNode(state: WorktreeSessionState, id: string): void {
  const operations = collectResourceSubtreeIds(state, id).map((subtreeId) => {
    const entry = requireResourceJournalEntry(state, subtreeId);
    return {
      kind: "delete" as const,
      domain: "resource" as const,
      entityId: subtreeId,
      entityKind: entry.type,
      label: entry.name,
      displayPath: entry.displayPath,
      beforeContent: entry.type === "file" ? entry.content : null,
    };
  });
  deleteResourceNodeFromCurrent(state, id);
  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "删除",
    groupKey: null,
    operations,
  });
}

export function readResourceFile(state: WorktreeSessionState, id: string): string {
  const node = requireResourceNode(state, id);
  if (node.type !== "file") {
    throw new Error(`Resource node is not a file: ${id}`);
  }
  return state.currentResources.entries.get(id)?.content ?? "";
}

export function writeResourceFile(state: WorktreeSessionState, id: string, content: string): void {
  const node = requireResourceNode(state, id);
  if (node.type !== "file") {
    throw new Error(`Resource node is not a file: ${id}`);
  }
  const entry = state.currentResources.entries.get(id);
  if (entry === undefined) {
    throw new Error(`Resource file is missing: ${id}`);
  }
  const beforeContent = entry.content;
  if (beforeContent === content) {
    return;
  }
  entry.content = content;
  persistAndEmit(state, false, {
    source: "autosave",
    title: "自动保存",
    groupKey: `autosave:resource:${id}`,
    operations: [
      {
        kind: "content",
        domain: "resource",
        entityId: id,
        entityKind: "file",
        label: entry.name,
        displayPath: entry.displayPath,
        beforeContent,
        afterContent: content,
      },
    ],
  });
}
