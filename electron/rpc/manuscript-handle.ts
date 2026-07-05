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
  MANUSCRIPT_ROOT_ID,
  clampChildIndex,
  cloneOutline,
  collectDescendantIds,
  createEmptyOutline,
  findParentId,
  normalizeManuscriptTitle,
  parseOutline,
  validateOutline,
} from "../manuscript-outline";
import {
  chapterBodyPath,
  ensureManuscriptStorage,
  MANUSCRIPT_OUTLINE_PATH,
} from "../manuscript-path";

const MANUSCRIPT_ID_SIZE = 10;

/**
 * RPC view of the branch worktree's ordered manuscript storage.
 */
export class ManuscriptHandleImpl extends RpcTarget implements ManuscriptHandle {
  readonly #worktree: VirtualWorktree;
  readonly #onDidChange: () => void;

  constructor(worktree: VirtualWorktree, onDidChange: () => void = () => undefined) {
    super();
    this.#worktree = worktree;
    this.#onDidChange = onDidChange;
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
      title: normalizeManuscriptTitle(title),
      children: [],
    };
    this.#insertChild(outline, parentId, folder, index);
    this.#writeOutline(outline);
    this.#onDidChange();
    return outline;
  }

  createChapter(parentId: string, title: string, index?: number): ManuscriptOutline {
    const outline = this.#readOutline();
    const chapter: ManuscriptChapterNode = {
      id: this.#createUniqueId(outline),
      type: "chapter",
      title: normalizeManuscriptTitle(title),
    };
    this.#worktree.writeFile(chapterBodyPath(chapter.id), Buffer.from("", "utf-8"));
    this.#insertChild(outline, parentId, chapter, index);
    this.#writeOutline(outline);
    this.#onDidChange();
    return outline;
  }

  renameNode(id: string, title: string): ManuscriptOutline {
    const outline = this.#readOutline();
    const node = this.#requireNode(outline, id);
    node.title = normalizeManuscriptTitle(title);
    this.#writeOutline(outline);
    this.#onDidChange();
    return outline;
  }

  moveNode(id: string, targetParentId: string, index?: number): ManuscriptOutline {
    if (id === MANUSCRIPT_ROOT_ID) {
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
        ? clampChildIndex(index - 1, insertionParent.children.length)
        : clampChildIndex(index, insertionParent.children.length);
    insertionParent.children.splice(nextIndex, 0, id);
    this.#writeOutline(outline);
    this.#onDidChange();
    return outline;
  }

  deleteNode(id: string): ManuscriptOutline {
    if (id === MANUSCRIPT_ROOT_ID) {
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
    this.#onDidChange();
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
    this.#onDidChange();
  }

  replaceOutline(outline: ManuscriptOutline): void {
    this.#writeOutline(outline);
  }

  deleteChapterBody(id: string): void {
    ensureManuscriptStorage(this.#worktree);
    this.#worktree.delete(chapterBodyPath(id), { force: true });
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
    parent.children.splice(clampChildIndex(index, parent.children.length), 0, node.id);
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
