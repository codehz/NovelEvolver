import type { SHA1 } from "nano-git";
import { nanoid } from "nanoid";

import type {
  ManuscriptTreeNode,
  ResourceTreeNode,
  ResourceTreeSnapshot,
} from "#shared/rpc/worktree-tree-rpc";

import { readTextFromTree } from "../git/diff-utils";
import { parseResourceIndex, resourceTreeFromIndex } from "../resources/index";
import type { ManuscriptEntry } from "../snapshots/manuscript";
import type { ResourceSnapshotEntry } from "../snapshots/resource";
import { MANUSCRIPT_ID_SIZE, RESOURCE_ID_SIZE, RESOURCES_INDEX_PATH } from "./state";
import type { WorktreeSessionState } from "./state";

export function resolveBaseTree(state: WorktreeSessionState): SHA1 {
  if (state.baseCommitSha === null) {
    return state.repo.createTree([]);
  }
  const object = state.repo.catFile(state.baseCommitSha);
  if (object.type !== "commit") {
    throw new Error(`Expected commit at ${state.baseCommitSha}, got ${object.type}.`);
  }
  return object.tree;
}

export function requireManuscriptNode(state: WorktreeSessionState, id: string): ManuscriptTreeNode {
  const node = state.manuscriptTree.nodes[id];
  if (node === undefined) {
    throw new Error(`Manuscript node does not exist: ${id}`);
  }
  return node;
}

export function requireManuscriptFolder(
  state: WorktreeSessionState,
  id: string,
): ManuscriptTreeNode & { type: "folder" } {
  const node = requireManuscriptNode(state, id);
  if (node.type !== "folder") {
    throw new Error(`Manuscript node is not a folder: ${id}`);
  }
  return node as ManuscriptTreeNode & { type: "folder" };
}

export function requireManuscriptJournalEntry(
  state: WorktreeSessionState,
  id: string,
): ManuscriptEntry {
  const entry = state.currentManuscript.entries.get(id);
  if (entry === undefined) {
    throw new Error(`Manuscript journal entry does not exist: ${id}`);
  }
  return entry;
}

export function requireResourceNode(state: WorktreeSessionState, id: string): ResourceTreeNode {
  const node = state.resourceTree.nodes[id];
  if (node === undefined) {
    throw new Error(`Resource node does not exist: ${id}`);
  }
  return node;
}

export function requireResourceFolder(
  state: WorktreeSessionState,
  id: string,
): ResourceTreeNode & { type: "folder" } {
  const node = requireResourceNode(state, id);
  if (node.type !== "folder") {
    throw new Error(`Resource node is not a folder: ${id}`);
  }
  return node as ResourceTreeNode & { type: "folder" };
}

export function requireResourceJournalEntry(
  state: WorktreeSessionState,
  id: string,
): ResourceSnapshotEntry {
  const entry = state.currentResources.entries.get(id);
  if (entry === undefined) {
    throw new Error(`Resource journal entry does not exist: ${id}`);
  }
  return entry;
}

export function isManuscriptDescendant(
  state: WorktreeSessionState,
  ancestorId: string,
  candidateId: string,
): boolean {
  let currentId: string | null | undefined = candidateId;
  while (currentId !== null && currentId !== undefined) {
    if (currentId === ancestorId) {
      return true;
    }
    currentId = state.manuscriptTree.nodes[currentId]?.parentId;
  }
  return false;
}

export function isResourceDescendant(
  state: WorktreeSessionState,
  ancestorId: string,
  candidateId: string,
): boolean {
  let currentId: string | null | undefined = candidateId;
  while (currentId !== null && currentId !== undefined) {
    if (currentId === ancestorId) {
      return true;
    }
    currentId = state.resourceTree.nodes[currentId]?.parentId;
  }
  return false;
}

export function collectManuscriptSubtreeIds(state: WorktreeSessionState, id: string): string[] {
  const ids: string[] = [];
  const visit = (nodeId: string): void => {
    ids.push(nodeId);
    const node = state.manuscriptTree.nodes[nodeId];
    if (node?.type === "folder") {
      node.childIds.forEach(visit);
    }
  };
  visit(id);
  return ids;
}

export function collectResourceSubtreeIds(state: WorktreeSessionState, id: string): string[] {
  const ids: string[] = [];
  const visit = (nodeId: string): void => {
    ids.push(nodeId);
    const node = state.resourceTree.nodes[nodeId];
    if (node?.type === "folder") {
      node.childIds.forEach(visit);
    }
  };
  visit(id);
  return ids;
}

export function assertResourceSiblingNameAvailable(
  state: WorktreeSessionState,
  parentId: string,
  name: string,
  excludeId?: string,
): void {
  const parent = requireResourceFolder(state, parentId);
  for (const childId of parent.childIds) {
    if (childId === excludeId) {
      continue;
    }
    const child = state.resourceTree.nodes[childId];
    if (child?.name === name) {
      throw new Error(`Resource name already exists: ${name}`);
    }
  }
}

export function createUniqueManuscriptId(state: WorktreeSessionState): string {
  let id = nanoid(MANUSCRIPT_ID_SIZE);
  while (
    state.manuscriptTree?.nodes[id] !== undefined ||
    state.baseManuscriptTree?.nodes[id] !== undefined
  ) {
    id = nanoid(MANUSCRIPT_ID_SIZE);
  }
  return id;
}

export function createResourceId(state: WorktreeSessionState): string {
  let id = `res_${nanoid(RESOURCE_ID_SIZE)}`;
  while (
    state.resourceTree?.nodes[id] !== undefined ||
    state.baseResourceTree?.nodes[id] !== undefined
  ) {
    id = `res_${nanoid(RESOURCE_ID_SIZE)}`;
  }
  return id;
}

export function readResourceTreeFromTree(
  state: WorktreeSessionState,
  treeHash: SHA1,
): ResourceTreeSnapshot {
  return resourceTreeFromIndex(
    parseResourceIndex(readTextFromTree(state.objects, treeHash, RESOURCES_INDEX_PATH)),
  );
}
