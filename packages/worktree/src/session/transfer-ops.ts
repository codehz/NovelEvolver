import { resourceParentPath } from "@novelevolver/domain/resource-library-path";
import type {
  WorktreeTransferCreated,
  WorktreeTransferInput,
  WorktreeTransferResult,
} from "@novelevolver/domain/worktree";
import { EXTERNAL_IMPORT_MAX_FILE_BYTES } from "@novelevolver/domain/worktree";

import type { JournalOperationCapture } from "../journal/journal-types";
import {
  clampChildIndex,
  MANUSCRIPT_ROOT_ID,
  normalizeManuscriptTitle,
} from "../manuscript/outline";
import { RESOURCE_ROOT_ID } from "../resources/index";
import {
  normalizeResourceNodeName,
  sortResourceChildrenByName,
} from "../trees/worktree-tree-bridge";
import {
  collectManuscriptSubtreeIds,
  collectResourceSubtreeIds,
  createResourceId,
  createUniqueManuscriptId,
  requireManuscriptFolder,
  requireManuscriptJournalEntry,
  requireManuscriptNode,
  requireResourceFolder,
  requireResourceJournalEntry,
  requireResourceNode,
} from "./helpers";
import { persistAndEmit } from "./persistence";
import { rebuildCurrentManuscriptFromTree, rebuildCurrentResourcesFromTree } from "./rebuild";
import { deleteManuscriptNodeFromCurrent, deleteResourceNodeFromCurrent } from "./revert";
import type { WorktreeSessionState } from "./state";

const CHAPTER_TITLE_STRIP_EXTENSIONS = [".markdown", ".md", ".txt"] as const;

function stripChapterTitleExtension(basename: string): string {
  const lower = basename.toLowerCase();
  for (const ext of CHAPTER_TITLE_STRIP_EXTENSIONS) {
    if (lower.endsWith(ext) && basename.length > ext.length) {
      return basename.slice(0, -ext.length);
    }
  }
  return basename;
}

type PlannedManuscriptNode = {
  relativePath: string;
  kind: "folder" | "chapter";
  title: string;
  content: string | null;
};

type PlannedResourceNode = {
  relativePath: string;
  kind: "folder" | "file";
  name: string;
  content: string | null;
};

function joinRelative(parentRel: string, name: string): string {
  return parentRel === "" ? name : `${parentRel}/${name}`;
}

function claimName(occupancy: Map<string, Set<string>>, parentRel: string, name: string): void {
  let names = occupancy.get(parentRel);
  if (names === undefined) {
    names = new Set();
    occupancy.set(parentRel, names);
  }
  if (names.has(name)) {
    throw new Error(`Resource name already exists: ${name}`);
  }
  names.add(name);
}

function seedResourceOccupancy(
  state: WorktreeSessionState,
  parentId: string,
  parentRel: string,
  occupancy: Map<string, Set<string>>,
): void {
  const parent = requireResourceFolder(state, parentId);
  const names = new Set<string>();
  for (const childId of parent.childIds) {
    const child = state.resourceTree.nodes[childId];
    if (child !== undefined) {
      names.add(child.name);
    }
  }
  occupancy.set(parentRel, names);
}

function planResourceToManuscript(
  state: WorktreeSessionState,
  sourceId: string,
): PlannedManuscriptNode[] {
  if (sourceId === RESOURCE_ROOT_ID) {
    throw new Error("Cannot transfer the resource library root.");
  }
  requireResourceNode(state, sourceId);

  const planned: PlannedManuscriptNode[] = [];

  const visit = (nodeId: string, parentRel: string): void => {
    const node = requireResourceNode(state, nodeId);
    if (node.type === "folder") {
      const title = normalizeManuscriptTitle(node.name);
      const relativePath = joinRelative(parentRel, node.name);
      planned.push({ relativePath, kind: "folder", title, content: null });
      for (const childId of node.childIds) {
        visit(childId, relativePath);
      }
      return;
    }

    const rawTitle = stripChapterTitleExtension(node.name);
    const title = normalizeManuscriptTitle(rawTitle);
    const content = state.currentResources.entries.get(nodeId)?.content ?? "";
    if (Buffer.byteLength(content, "utf8") >= EXTERNAL_IMPORT_MAX_FILE_BYTES) {
      throw new Error(`文件超过 ${EXTERNAL_IMPORT_MAX_FILE_BYTES} 字节: ${node.name}`);
    }
    const relativePath = joinRelative(parentRel, node.name);
    planned.push({ relativePath, kind: "chapter", title, content });
  };

  visit(sourceId, "");
  return planned;
}

function planManuscriptToResource(
  state: WorktreeSessionState,
  sourceId: string,
  targetParentId: string,
): PlannedResourceNode[] {
  if (sourceId === MANUSCRIPT_ROOT_ID) {
    throw new Error("Cannot transfer the manuscript root.");
  }
  requireManuscriptNode(state, sourceId);
  requireResourceFolder(state, targetParentId);

  const occupancy = new Map<string, Set<string>>();
  seedResourceOccupancy(state, targetParentId, "", occupancy);

  const planned: PlannedResourceNode[] = [];

  const visit = (nodeId: string, parentRel: string): void => {
    const node = requireManuscriptNode(state, nodeId);
    if (node.type === "folder") {
      const name = normalizeResourceNodeName(node.title);
      claimName(occupancy, parentRel, name);
      const relativePath = joinRelative(parentRel, name);
      planned.push({ relativePath, kind: "folder", name, content: null });
      occupancy.set(relativePath, new Set());
      for (const childId of node.childIds) {
        visit(childId, relativePath);
      }
      return;
    }

    const name = normalizeResourceNodeName(`${node.title}.md`);
    claimName(occupancy, parentRel, name);
    const content = state.currentManuscript.entries.get(nodeId)?.content ?? "";
    if (Buffer.byteLength(content, "utf8") >= EXTERNAL_IMPORT_MAX_FILE_BYTES) {
      throw new Error(`文件超过 ${EXTERNAL_IMPORT_MAX_FILE_BYTES} 字节: ${node.title}`);
    }
    const relativePath = joinRelative(parentRel, name);
    planned.push({ relativePath, kind: "file", name, content });
  };

  visit(sourceId, "");
  return planned;
}

function applyResourceToManuscript(
  state: WorktreeSessionState,
  sourceId: string,
  targetParentId: string,
  planned: readonly PlannedManuscriptNode[],
  index: number | undefined,
): WorktreeTransferResult {
  requireManuscriptFolder(state, targetParentId);

  const removedSourceIds = collectResourceSubtreeIds(state, sourceId);
  const sourceDeleteOps: JournalOperationCapture[] = removedSourceIds.map((subtreeId) => {
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

  const pathToNodeId = new Map<string, string>();
  const contentOverrides = new Map<string, string>();
  const createdMeta: Array<{ nodeId: string; kind: "folder" | "chapter" }> = [];
  let nextTopLevelIndex = clampChildIndex(
    index,
    requireManuscriptFolder(state, targetParentId).childIds.length,
  );

  for (const item of planned) {
    const parentRelative = resourceParentPath(item.relativePath);
    const isTopLevel = parentRelative === "";
    const parentId = isTopLevel ? targetParentId : (pathToNodeId.get(parentRelative) ?? null);
    if (parentId === null) {
      throw new Error(`Missing planned parent for: ${item.relativePath}`);
    }
    const parent = requireManuscriptFolder(state, parentId);
    const nodeId = createUniqueManuscriptId(state);

    if (item.kind === "folder") {
      state.manuscriptTree.nodes[nodeId] = {
        id: nodeId,
        type: "folder",
        title: item.title,
        parentId,
        childIds: [],
      };
    } else {
      state.manuscriptTree.nodes[nodeId] = {
        id: nodeId,
        type: "chapter",
        title: item.title,
        parentId,
        childIds: [],
      };
      contentOverrides.set(nodeId, item.content ?? "");
    }

    if (isTopLevel) {
      parent.childIds.splice(nextTopLevelIndex, 0, nodeId);
      nextTopLevelIndex += 1;
    } else {
      parent.childIds.push(nodeId);
    }

    pathToNodeId.set(item.relativePath, nodeId);
    createdMeta.push({ nodeId, kind: item.kind });
  }

  rebuildCurrentManuscriptFromTree(state, contentOverrides);
  deleteResourceNodeFromCurrent(state, sourceId);

  const created: WorktreeTransferCreated[] = createdMeta.map((item) => {
    const entry = requireManuscriptJournalEntry(state, item.nodeId);
    return {
      domain: "manuscript" as const,
      nodeId: item.nodeId,
      kind: item.kind,
      label: entry.title,
    };
  });

  const createOps: JournalOperationCapture[] = createdMeta.map((item) => {
    const entry = requireManuscriptJournalEntry(state, item.nodeId);
    return {
      kind: "create" as const,
      domain: "manuscript" as const,
      entityId: item.nodeId,
      entityKind: item.kind === "chapter" ? "chapter" : "folder",
      label: entry.title,
      displayPath: entry.displayPath,
      afterContent: item.kind === "chapter" ? entry.content : null,
    };
  });

  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "移动到手稿",
    groupKey: null,
    operations: [...createOps, ...sourceDeleteOps],
  });

  return {
    sourceRootId: sourceId,
    removedSourceIds,
    created,
  };
}

function applyManuscriptToResource(
  state: WorktreeSessionState,
  sourceId: string,
  targetParentId: string,
  planned: readonly PlannedResourceNode[],
): WorktreeTransferResult {
  requireResourceFolder(state, targetParentId);

  const removedSourceIds = collectManuscriptSubtreeIds(state, sourceId);
  const sourceDeleteOps: JournalOperationCapture[] = removedSourceIds.map((subtreeId) => {
    const entry = requireManuscriptJournalEntry(state, subtreeId);
    return {
      kind: "delete" as const,
      domain: "manuscript" as const,
      entityId: subtreeId,
      entityKind: entry.type === "chapter" ? ("chapter" as const) : ("folder" as const),
      label: entry.title,
      displayPath: entry.displayPath,
      beforeContent: entry.type === "chapter" ? entry.content : null,
    };
  });

  const pathToNodeId = new Map<string, string>();
  const contentOverrides = new Map<string, string>();
  const parentsToSort = new Set<string>([targetParentId]);
  const createdMeta: Array<{ nodeId: string; kind: "folder" | "file" }> = [];

  for (const item of planned) {
    const parentRelative = resourceParentPath(item.relativePath);
    const isTopLevel = parentRelative === "";
    const parentId = isTopLevel ? targetParentId : (pathToNodeId.get(parentRelative) ?? null);
    if (parentId === null) {
      throw new Error(`Missing planned parent for: ${item.relativePath}`);
    }
    const parent = requireResourceFolder(state, parentId);
    const nodeId = createResourceId(state);

    if (item.kind === "folder") {
      state.resourceTree.nodes[nodeId] = {
        id: nodeId,
        type: "folder",
        name: item.name,
        parentId,
        childIds: [],
      };
    } else {
      state.resourceTree.nodes[nodeId] = {
        id: nodeId,
        type: "file",
        name: item.name,
        parentId,
        childIds: [],
      };
      contentOverrides.set(nodeId, item.content ?? "");
    }

    parent.childIds.push(nodeId);
    parentsToSort.add(parentId);
    pathToNodeId.set(item.relativePath, nodeId);
    createdMeta.push({ nodeId, kind: item.kind });
  }

  for (const parentId of parentsToSort) {
    sortResourceChildrenByName(state.resourceTree, parentId);
  }

  rebuildCurrentResourcesFromTree(state, contentOverrides);
  deleteManuscriptNodeFromCurrent(state, sourceId);

  const created: WorktreeTransferCreated[] = createdMeta.map((item) => {
    const entry = requireResourceJournalEntry(state, item.nodeId);
    return {
      domain: "resource" as const,
      nodeId: item.nodeId,
      kind: item.kind,
      label: entry.name,
    };
  });

  const createOps: JournalOperationCapture[] = createdMeta.map((item) => {
    const entry = requireResourceJournalEntry(state, item.nodeId);
    return {
      kind: "create" as const,
      domain: "resource" as const,
      entityId: item.nodeId,
      entityKind: item.kind,
      label: entry.name,
      displayPath: entry.displayPath,
      afterContent: item.kind === "file" ? entry.content : null,
    };
  });

  persistAndEmit(state, false, {
    source: "structure-edit",
    title: "移动到资源库",
    groupKey: null,
    operations: [...createOps, ...sourceDeleteOps],
  });

  return {
    sourceRootId: sourceId,
    removedSourceIds,
    created,
  };
}

export function transferNode(
  state: WorktreeSessionState,
  input: WorktreeTransferInput,
): WorktreeTransferResult {
  const { sourceDomain, sourceId, targetDomain, targetParentId, index } = input;

  if (sourceDomain === targetDomain) {
    throw new Error("transferNode requires different source and target domains.");
  }
  if (sourceId === "") {
    throw new Error("Source id must not be empty.");
  }

  if (sourceDomain === "resource" && targetDomain === "manuscript") {
    const planned = planResourceToManuscript(state, sourceId);
    if (planned.length === 0) {
      throw new Error("Nothing to transfer.");
    }
    return applyResourceToManuscript(state, sourceId, targetParentId, planned, index);
  }

  if (sourceDomain === "manuscript" && targetDomain === "resource") {
    const planned = planManuscriptToResource(state, sourceId, targetParentId);
    if (planned.length === 0) {
      throw new Error("Nothing to transfer.");
    }
    return applyManuscriptToResource(state, sourceId, targetParentId, planned);
  }

  throw new Error(`Unsupported transfer direction: ${sourceDomain} → ${targetDomain}`);
}
