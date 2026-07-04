import { RpcTarget } from "capnweb";
import type { VirtualWorktree } from "nano-git/worktree/core";
import { nanoid } from "nanoid";

import type {
  ManuscriptChapterNode,
  ManuscriptFolderNode,
  ManuscriptHandle,
  ManuscriptNode,
  ManuscriptOutline,
} from "#shared/rpc/projects-rpc";

import {
  assertValidManuscriptId,
  chapterBodyPath,
  ensureManuscriptStorage,
  MANUSCRIPT_OUTLINE_PATH,
} from "../manuscript-path";

const ROOT_ID = "root";
const MANUSCRIPT_ID_SIZE = 10;

function createEmptyOutline(): ManuscriptOutline {
  return {
    version: 1,
    rootId: ROOT_ID,
    nodes: {
      [ROOT_ID]: {
        id: ROOT_ID,
        type: "folder",
        title: "手稿",
        children: [],
      },
    },
  };
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (normalized === "") {
    throw new Error("Title must not be empty.");
  }
  return normalized;
}

function cloneOutline(outline: ManuscriptOutline): ManuscriptOutline {
  return {
    version: 1,
    rootId: "root",
    nodes: Object.fromEntries(
      Object.entries(outline.nodes).map(([id, node]) => [
        id,
        node.type === "folder" ? { ...node, children: [...node.children] } : { ...node },
      ]),
    ),
  };
}

function parseOutline(content: string): ManuscriptOutline {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Manuscript outline is not valid JSON.");
  }
  return validateOutline(parsed);
}

function validateOutline(value: unknown): ManuscriptOutline {
  if (typeof value !== "object" || value === null) {
    throw new Error("Manuscript outline must be an object.");
  }
  const outline = value as Partial<ManuscriptOutline>;
  if (outline.version !== 1) {
    throw new Error("Unsupported manuscript outline version.");
  }
  if (outline.rootId !== ROOT_ID) {
    throw new Error("Manuscript outline rootId must be root.");
  }
  if (typeof outline.nodes !== "object" || outline.nodes === null) {
    throw new Error("Manuscript outline nodes must be an object.");
  }

  const nodes: Record<string, ManuscriptNode> = {};
  for (const [id, rawNode] of Object.entries(outline.nodes as Record<string, unknown>)) {
    if (id !== ROOT_ID) {
      assertValidManuscriptId(id);
    }
    if (typeof rawNode !== "object" || rawNode === null) {
      throw new Error(`Invalid manuscript node: ${id}`);
    }
    const node = rawNode as Partial<ManuscriptNode>;
    if (node.id !== id) {
      throw new Error(`Manuscript node id mismatch: ${id}`);
    }
    if (typeof node.title !== "string" || node.title.trim() === "") {
      throw new Error(`Manuscript node title must not be empty: ${id}`);
    }
    if (node.type === "folder") {
      const children = (node as Partial<ManuscriptFolderNode>).children;
      if (!Array.isArray(children) || children.some((child) => typeof child !== "string")) {
        throw new Error(`Manuscript folder children must be string IDs: ${id}`);
      }
      nodes[id] = { id, type: "folder", title: node.title, children: [...children] };
    } else if (node.type === "chapter") {
      if ("children" in node) {
        throw new Error(`Manuscript chapter must be a leaf node: ${id}`);
      }
      nodes[id] = { id, type: "chapter", title: node.title };
    } else {
      throw new Error(`Invalid manuscript node type: ${id}`);
    }
  }

  const root = nodes[ROOT_ID];
  if (root === undefined || root.type !== "folder") {
    throw new Error("Manuscript outline root folder is missing.");
  }

  const parentById = new Map<string, string>();
  for (const node of Object.values(nodes)) {
    if (node.type !== "folder") {
      continue;
    }
    const seenChildren = new Set<string>();
    for (const childId of node.children) {
      if (seenChildren.has(childId)) {
        throw new Error(`Manuscript folder contains duplicate child: ${childId}`);
      }
      seenChildren.add(childId);
      if (nodes[childId] === undefined) {
        throw new Error(`Manuscript child does not exist: ${childId}`);
      }
      if (childId === ROOT_ID) {
        throw new Error("Manuscript root cannot be a child node.");
      }
      if (parentById.has(childId)) {
        throw new Error(`Manuscript node has multiple parents: ${childId}`);
      }
      parentById.set(childId, node.id);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      throw new Error(`Manuscript outline contains a cycle at: ${id}`);
    }
    visiting.add(id);
    const node = nodes[id];
    if (node?.type === "folder") {
      for (const childId of node.children) {
        visit(childId);
      }
    }
    visiting.delete(id);
    visited.add(id);
  };
  visit(ROOT_ID);
  if (visited.size !== Object.keys(nodes).length) {
    throw new Error("Manuscript outline contains unreachable nodes.");
  }

  return { version: 1, rootId: "root", nodes };
}

function clampIndex(index: number | undefined, length: number): number {
  if (index === undefined || !Number.isFinite(index)) {
    return length;
  }
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

function findParentId(outline: ManuscriptOutline, id: string): string | null {
  for (const node of Object.values(outline.nodes)) {
    if (node.type === "folder" && node.children.includes(id)) {
      return node.id;
    }
  }
  return null;
}

function collectDescendantIds(outline: ManuscriptOutline, id: string): string[] {
  const node = outline.nodes[id];
  if (node === undefined || node.type === "chapter") {
    return [];
  }
  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId, ...collectDescendantIds(outline, childId));
  }
  return descendants;
}

/**
 * RPC view of the branch worktree's ordered manuscript storage.
 */
export class ManuscriptHandleImpl extends RpcTarget implements ManuscriptHandle {
  readonly #worktree: VirtualWorktree;

  constructor(worktree: VirtualWorktree) {
    super();
    this.#worktree = worktree;
    this.#ensureInitialized();
  }

  getOutline(): ManuscriptOutline {
    return this.#readOutline();
  }

  createFolder(parentId: string, title: string, index?: number): ManuscriptOutline {
    const outline = this.#readOutline();
    const folder: ManuscriptFolderNode = {
      id: this.#createUniqueId(outline),
      type: "folder",
      title: normalizeTitle(title),
      children: [],
    };
    this.#insertChild(outline, parentId, folder, index);
    this.#writeOutline(outline);
    return outline;
  }

  createChapter(parentId: string, title: string, index?: number): ManuscriptOutline {
    const outline = this.#readOutline();
    const chapter: ManuscriptChapterNode = {
      id: this.#createUniqueId(outline),
      type: "chapter",
      title: normalizeTitle(title),
    };
    this.#worktree.writeFile(chapterBodyPath(chapter.id), Buffer.from("", "utf-8"));
    this.#insertChild(outline, parentId, chapter, index);
    this.#writeOutline(outline);
    return outline;
  }

  renameNode(id: string, title: string): ManuscriptOutline {
    const outline = this.#readOutline();
    const node = this.#requireNode(outline, id);
    node.title = normalizeTitle(title);
    this.#writeOutline(outline);
    return outline;
  }

  moveNode(id: string, targetParentId: string, index?: number): ManuscriptOutline {
    if (id === ROOT_ID) {
      throw new Error("Cannot move the manuscript root.");
    }
    const outline = this.#readOutline();
    this.#requireNode(outline, id);
    const targetParent = this.#requireFolder(outline, targetParentId);
    if (targetParentId === id || collectDescendantIds(outline, id).includes(targetParentId)) {
      throw new Error("Cannot move a manuscript node into itself or its descendants.");
    }
    const sourceParentId = findParentId(outline, id);
    if (sourceParentId === null) {
      throw new Error(`Manuscript node has no parent: ${id}`);
    }
    const sourceParent = this.#requireFolder(outline, sourceParentId);
    const previousIndex = sourceParent.children.indexOf(id);
    sourceParent.children.splice(previousIndex, 1);

    const insertionParent = this.#requireFolder(outline, targetParent.id);
    const nextIndex =
      sourceParent.id === insertionParent.id && index !== undefined && index > previousIndex
        ? clampIndex(index - 1, insertionParent.children.length)
        : clampIndex(index, insertionParent.children.length);
    insertionParent.children.splice(nextIndex, 0, id);
    this.#writeOutline(outline);
    return outline;
  }

  deleteNode(id: string): ManuscriptOutline {
    if (id === ROOT_ID) {
      throw new Error("Cannot delete the manuscript root.");
    }
    const outline = this.#readOutline();
    const node = this.#requireNode(outline, id);
    const parentId = findParentId(outline, id);
    if (parentId === null) {
      throw new Error(`Manuscript node has no parent: ${id}`);
    }
    const parent = this.#requireFolder(outline, parentId);
    const idsToDelete = [id, ...collectDescendantIds(outline, id)];
    parent.children = parent.children.filter((childId) => childId !== id);
    for (const deleteId of idsToDelete) {
      delete outline.nodes[deleteId];
    }
    this.#writeOutline(outline);
    for (const deleteId of idsToDelete) {
      if (node.type === "chapter" || outline.nodes[deleteId] === undefined) {
        this.#worktree.delete(chapterBodyPath(deleteId), { force: true });
      }
    }
    return outline;
  }

  readChapter(id: string): string {
    const outline = this.#readOutline();
    this.#requireChapter(outline, id);
    const path = chapterBodyPath(id);
    const stat = this.#worktree.stat(path);
    if (stat === null || stat.kind !== "blob") {
      throw new Error(`Manuscript chapter body is missing: ${id}`);
    }
    return this.#worktree.readFile(path).toString("utf-8");
  }

  writeChapter(id: string, content: string): void {
    const outline = this.#readOutline();
    this.#requireChapter(outline, id);
    ensureManuscriptStorage(this.#worktree);
    this.#worktree.writeFile(chapterBodyPath(id), Buffer.from(content, "utf-8"));
  }

  #ensureInitialized(): void {
    ensureManuscriptStorage(this.#worktree);
    if (!this.#worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
      this.#writeOutline(createEmptyOutline());
      return;
    }
    const stat = this.#worktree.stat(MANUSCRIPT_OUTLINE_PATH);
    if (stat?.kind !== "blob") {
      throw new Error("Manuscript outline path is not a file.");
    }
    this.#readOutline();
  }

  #readOutline(): ManuscriptOutline {
    ensureManuscriptStorage(this.#worktree);
    const stat = this.#worktree.stat(MANUSCRIPT_OUTLINE_PATH);
    if (stat === null) {
      const outline = createEmptyOutline();
      this.#writeOutline(outline);
      return outline;
    }
    if (stat.kind !== "blob") {
      throw new Error("Manuscript outline path is not a file.");
    }
    return parseOutline(this.#worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8"));
  }

  #writeOutline(outline: ManuscriptOutline): void {
    ensureManuscriptStorage(this.#worktree);
    const validated = validateOutline(cloneOutline(outline));
    this.#worktree.writeFile(
      MANUSCRIPT_OUTLINE_PATH,
      Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf-8"),
    );
  }

  #createUniqueId(outline: ManuscriptOutline): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const id = nanoid(MANUSCRIPT_ID_SIZE);
      if (outline.nodes[id] === undefined) {
        return id;
      }
    }
    throw new Error("Failed to create a unique manuscript node id.");
  }

  #insertChild(
    outline: ManuscriptOutline,
    parentId: string,
    node: ManuscriptNode,
    index: number | undefined,
  ): void {
    const parent = this.#requireFolder(outline, parentId);
    outline.nodes[node.id] = node;
    parent.children.splice(clampIndex(index, parent.children.length), 0, node.id);
  }

  #requireNode(outline: ManuscriptOutline, id: string): ManuscriptNode {
    const node = outline.nodes[id];
    if (node === undefined) {
      throw new Error(`Manuscript node does not exist: ${id}`);
    }
    return node;
  }

  #requireFolder(outline: ManuscriptOutline, id: string): ManuscriptFolderNode {
    const node = this.#requireNode(outline, id);
    if (node.type !== "folder") {
      throw new Error(`Manuscript node is not a folder: ${id}`);
    }
    return node;
  }

  #requireChapter(outline: ManuscriptOutline, id: string): ManuscriptChapterNode {
    const node = this.#requireNode(outline, id);
    if (node.type !== "chapter") {
      throw new Error(`Manuscript node is not a chapter: ${id}`);
    }
    return node;
  }
}
