import { resourceBaseName, resourceParentPath } from "#shared/resource-library-path";
import type {
  ResourceImportCreated,
  ResourceImportEntry,
  ResourceImportResult,
  ResourceImportSkip,
  WorktreeNodeIdResult,
} from "#shared/rpc/worktree/index";
import { RESOURCE_IMPORT_MAX_FILE_BYTES } from "#shared/rpc/worktree/index";

import type { JournalOperationCapture } from "../journal/journal-types";
import { RESOURCE_ROOT_ID } from "../resources/index";
import { assertResourceLibraryFilePath, assertResourceLibraryListPath } from "../resources/paths";
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

export type ResourceFileListEntry = {
  id: string;
  path: string;
  name: string;
};

export function listResourceFiles(
  state: WorktreeSessionState,
  relativePath: string,
): ResourceFileListEntry[] {
  assertResourceLibraryListPath(relativePath);

  const folderId =
    relativePath === "" ? RESOURCE_ROOT_ID : state.resourceIdByPath.get(relativePath);
  if (folderId === undefined) {
    throw new Error(`Resource directory does not exist: ${relativePath}`);
  }

  const folder = requireResourceFolder(state, folderId);
  const files: ResourceFileListEntry[] = [];

  const visit = (nodeId: string): void => {
    const node = requireResourceNode(state, nodeId);
    if (node.type === "file") {
      const path = state.resourcePathById.get(nodeId);
      if (path === undefined) {
        throw new Error(`Resource path missing for node: ${nodeId}`);
      }
      files.push({
        id: nodeId,
        path,
        name: node.name,
      });
      return;
    }

    for (const childId of node.childIds) {
      visit(childId);
    }
  };

  for (const childId of folder.childIds) {
    visit(childId);
  }

  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

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

export function readResourceFileByPath(state: WorktreeSessionState, relativePath: string): string {
  assertResourceLibraryFilePath(relativePath);
  const id = state.resourceIdByPath.get(relativePath);
  if (id === undefined) {
    throw new Error(`Resource file does not exist: ${relativePath}`);
  }
  return readResourceFile(state, id);
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

function findSiblingByName(
  state: WorktreeSessionState,
  parentId: string,
  name: string,
): { id: string; type: "file" | "folder" } | null {
  const parent = requireResourceFolder(state, parentId);
  for (const childId of parent.childIds) {
    const child = state.resourceTree.nodes[childId];
    if (child?.name === name) {
      return { id: childId, type: child.type };
    }
  }
  return null;
}

function tryNormalizeImportName(
  relativePath: string,
): { name: string } | { skip: ResourceImportSkip } {
  if (relativePath === "") {
    return {
      skip: {
        relativePath,
        reason: "empty-path",
        message: "路径不能为空",
      },
    };
  }
  try {
    const name = normalizeResourceNodeName(resourceBaseName(relativePath));
    return { name };
  } catch (error) {
    return {
      skip: {
        relativePath,
        reason: "invalid-name",
        message: error instanceof Error ? error.message : "名称无效",
      },
    };
  }
}

/**
 * Batch-import folders and UTF-8 text files under `targetParentId`.
 * Folder name conflicts merge into the existing folder; file name conflicts are skipped.
 * Emits a single journal revision when any node is created.
 */
export function importResourceEntries(
  state: WorktreeSessionState,
  targetParentId: string,
  entries: readonly ResourceImportEntry[],
): ResourceImportResult {
  requireResourceFolder(state, targetParentId);

  const deduped = new Map<string, ResourceImportEntry>();
  for (const entry of entries) {
    deduped.set(entry.relativePath, entry);
  }

  const ordered = [...deduped.values()].sort((left, right) => {
    const leftDepth = left.relativePath === "" ? 0 : left.relativePath.split("/").length;
    const rightDepth = right.relativePath === "" ? 0 : right.relativePath.split("/").length;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    return left.relativePath.localeCompare(right.relativePath);
  });

  const pathToNodeId = new Map<string, string>();
  const created: ResourceImportCreated[] = [];
  const skipped: ResourceImportSkip[] = [];
  const contentOverrides = new Map<string, string>();
  const parentsToSort = new Set<string>();

  for (const entry of ordered) {
    const normalized = tryNormalizeImportName(entry.relativePath);
    if ("skip" in normalized) {
      skipped.push(normalized.skip);
      continue;
    }
    const { name } = normalized;
    const parentRelative = resourceParentPath(entry.relativePath);
    const parentId =
      parentRelative === "" ? targetParentId : (pathToNodeId.get(parentRelative) ?? null);
    if (parentId === null) {
      skipped.push({
        relativePath: entry.relativePath,
        reason: "missing-parent",
        message: `缺少父目录: ${parentRelative}`,
      });
      continue;
    }

    if (entry.kind === "folder") {
      const existing = findSiblingByName(state, parentId, name);
      if (existing !== null) {
        if (existing.type === "folder") {
          pathToNodeId.set(entry.relativePath, existing.id);
          continue;
        }
        skipped.push({
          relativePath: entry.relativePath,
          reason: "type-conflict",
          message: `已存在同名文件: ${name}`,
        });
        continue;
      }
      const nodeId = createResourceId(state);
      const parent = requireResourceFolder(state, parentId);
      state.resourceTree.nodes[nodeId] = {
        id: nodeId,
        type: "folder",
        name,
        parentId,
        childIds: [],
      };
      parent.childIds.push(nodeId);
      parentsToSort.add(parentId);
      pathToNodeId.set(entry.relativePath, nodeId);
      created.push({ nodeId, relativePath: entry.relativePath, kind: "folder" });
      continue;
    }

    if (Buffer.byteLength(entry.content, "utf8") >= RESOURCE_IMPORT_MAX_FILE_BYTES) {
      skipped.push({
        relativePath: entry.relativePath,
        reason: "too-large",
        message: `文件超过 ${RESOURCE_IMPORT_MAX_FILE_BYTES} 字节`,
      });
      continue;
    }

    const existing = findSiblingByName(state, parentId, name);
    if (existing !== null) {
      skipped.push({
        relativePath: entry.relativePath,
        reason: existing.type === "file" ? "name-conflict" : "type-conflict",
        message: existing.type === "file" ? `已存在同名文件: ${name}` : `已存在同名文件夹: ${name}`,
      });
      continue;
    }

    const nodeId = createResourceId(state);
    const parent = requireResourceFolder(state, parentId);
    state.resourceTree.nodes[nodeId] = {
      id: nodeId,
      type: "file",
      name,
      parentId,
      childIds: [],
    };
    parent.childIds.push(nodeId);
    parentsToSort.add(parentId);
    pathToNodeId.set(entry.relativePath, nodeId);
    contentOverrides.set(nodeId, entry.content);
    created.push({ nodeId, relativePath: entry.relativePath, kind: "file" });
  }

  if (created.length === 0) {
    return { created, skipped };
  }

  for (const parentId of parentsToSort) {
    sortResourceChildrenByName(state.resourceTree, parentId);
  }

  rebuildCurrentResourcesFromTree(state, contentOverrides);

  const operations: JournalOperationCapture[] = [];
  for (const item of created) {
    const journalEntry = requireResourceJournalEntry(state, item.nodeId);
    operations.push({
      kind: "create",
      domain: "resource",
      entityId: item.nodeId,
      entityKind: item.kind,
      label: journalEntry.name,
      displayPath: journalEntry.displayPath,
      afterContent: item.kind === "file" ? journalEntry.content : null,
    });
  }

  persistAndEmit(state, false, {
    source: "import",
    title: created.length === 1 ? "导入文件" : `导入 ${created.length} 项`,
    groupKey: null,
    operations,
  });

  return { created, skipped };
}
