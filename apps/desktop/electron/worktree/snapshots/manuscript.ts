import type { SHA1 } from "nano-git";

import type { ManuscriptNode, ManuscriptOutline } from "#domain/worktree";

import { readTextFromTree, type ObjectDatabase } from "../git/diff-utils";
import { createEmptyOutline, parseOutline } from "../manuscript/outline";
import { chapterBodyPath, MANUSCRIPT_OUTLINE_PATH } from "../manuscript/paths";

export type { ObjectDatabase };

export type ManuscriptEntry = {
  id: string;
  type: ManuscriptNode["type"];
  title: string;
  parentId: string;
  index: number;
  depth: number;
  displayPath: string;
  order: number;
  childIds: string[];
  content: string;
};

export type ManuscriptSnapshotState = {
  outline: ManuscriptOutline;
  entries: Map<string, ManuscriptEntry>;
};

function readOutlineFromBase(objects: ObjectDatabase, baseTree: SHA1): ManuscriptOutline {
  const content = readTextFromTree(objects, baseTree, MANUSCRIPT_OUTLINE_PATH);
  return content === null ? createEmptyOutline() : parseOutline(content);
}

export function buildManuscriptSnapshot(
  outline: ManuscriptOutline,
  readChapter: (id: string) => string,
): ManuscriptSnapshotState {
  const entries = new Map<string, ManuscriptEntry>();
  let order = 0;

  const visit = (parentId: string, parentPath: string, depth: number): void => {
    const parent = outline.nodes[parentId];
    if (parent?.type !== "folder") {
      return;
    }

    parent.children.forEach((childId, index) => {
      const node = outline.nodes[childId];
      if (node === undefined) {
        throw new Error(`Missing manuscript node: ${childId}`);
      }
      const displayPath = parentPath === "" ? node.title : `${parentPath}/${node.title}`;
      const entry: ManuscriptEntry = {
        id: node.id,
        type: node.type,
        title: node.title,
        parentId,
        index,
        depth,
        displayPath,
        order,
        childIds: node.type === "folder" ? [...node.children] : [],
        content: node.type === "chapter" ? readChapter(node.id) : "",
      };
      entries.set(node.id, entry);
      order += 1;

      if (node.type === "folder") {
        visit(node.id, displayPath, depth + 1);
      }
    });
  };

  visit(outline.rootId, "", 0);

  return { outline, entries };
}

export function buildBaseManuscriptSnapshot(
  objects: ObjectDatabase,
  baseTree: SHA1,
): ManuscriptSnapshotState {
  const outline = readOutlineFromBase(objects, baseTree);
  return buildManuscriptSnapshot(
    outline,
    (id) => readTextFromTree(objects, baseTree, chapterBodyPath(id)) ?? "",
  );
}
