import { createHash } from "node:crypto";

import type { SHA1 } from "nano-git";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";

import { resourceBaseName, resourceParentPath } from "#shared/resource-library-path";
import type { ManuscriptNode, ManuscriptOutline } from "#shared/rpc/manuscript-rpc";

import { readTextFromTree, type ObjectDatabase } from "./git/diff-utils";
import {
  cloneOutline,
  createEmptyOutline,
  parseOutline,
  validateOutline,
} from "./manuscript/outline";
import {
  chapterBodyPath,
  ensureManuscriptStorage,
  MANUSCRIPT_OUTLINE_PATH,
} from "./manuscript/paths";
import { joinWorktreeChild, RESOURCES_DIR, toWorktreePath } from "./resources/paths";

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

export type ResourceEntry = {
  path: string;
  type: "file" | "folder";
  name: string;
  parentPath: string;
  depth: number;
  displayPath: string;
  order: number;
  content: string;
  hash: string;
};

export type ResourceSnapshotState = {
  entries: Map<string, ResourceEntry>;
};

function sha1Text(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

export function sortWorktreeEntries(
  entries: Array<{ name: string; kind: string }>,
): Array<{ name: string; kind: string }> {
  return [...entries].sort((left, right) => {
    if (left.kind === right.kind) {
      return left.name.localeCompare(right.name);
    }
    return left.kind === "tree" ? -1 : 1;
  });
}

export function resourceDepth(path: string): number {
  return path === "" ? 0 : path.split("/").length - 1;
}

export function readOutlineFromWorktree(worktree: VirtualWorktree): ManuscriptOutline {
  if (!worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
    return createEmptyOutline();
  }
  const stat = worktree.stat(MANUSCRIPT_OUTLINE_PATH);
  if (stat?.kind !== "blob") {
    throw new Error("Manuscript outline path is not a file.");
  }
  return parseOutline(worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8"));
}

export function writeOutlineToWorktree(
  worktree: VirtualWorktree,
  outline: ManuscriptOutline,
): void {
  ensureManuscriptStorage(worktree);
  const validated = validateOutline(cloneOutline(outline));
  worktree.writeFile(
    MANUSCRIPT_OUTLINE_PATH,
    Buffer.from(`${JSON.stringify(validated, null, 2)}\n`, "utf-8"),
  );
}

export function readOutlineFromBase(objects: ObjectDatabase, baseTree: SHA1): ManuscriptOutline {
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

export function buildCurrentManuscriptSnapshot(worktree: VirtualWorktree): ManuscriptSnapshotState {
  const outline = readOutlineFromWorktree(worktree);
  return buildManuscriptSnapshot(outline, (id) =>
    worktree.exists(chapterBodyPath(id))
      ? worktree.readFile(chapterBodyPath(id)).toString("utf-8")
      : "",
  );
}

export function buildBaseResourceSnapshot(
  objects: ObjectDatabase,
  baseTree: SHA1,
): ResourceSnapshotState {
  const entries = new Map<string, ResourceEntry>();
  let order = 0;

  for (const snapshotEntry of readTreeSnapshot(objects, baseTree)) {
    const { path, object } = snapshotEntry;
    if (!path.startsWith(`${RESOURCES_DIR}/`)) {
      continue;
    }
    const relativePath = path.slice(RESOURCES_DIR.length + 1);
    if (relativePath === "") {
      continue;
    }
    entries.set(relativePath, {
      path: relativePath,
      type: object.kind === "tree" ? "folder" : "file",
      name: resourceBaseName(relativePath),
      parentPath: resourceParentPath(relativePath),
      depth: resourceDepth(relativePath),
      displayPath: relativePath,
      order,
      content:
        object.kind === "blob"
          ? (readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, relativePath)) ??
            "")
          : "",
      hash: object.hash,
    });
    order += 1;
  }

  return { entries };
}

export function buildCurrentResourceSnapshot(worktree: VirtualWorktree): ResourceSnapshotState {
  const entries = new Map<string, ResourceEntry>();
  let order = 0;

  if (!worktree.exists(RESOURCES_DIR)) {
    return { entries };
  }

  const visit = (resourcePath: string): void => {
    const worktreePath = resourcePath === "" ? RESOURCES_DIR : toWorktreePath(resourcePath);
    const dirEntries = sortWorktreeEntries(
      worktree
        .readdir(worktreePath)
        .filter((entry) => entry.kind === "blob" || entry.kind === "tree"),
    );

    for (const dirEntry of dirEntries) {
      const childPath = resourcePath === "" ? dirEntry.name : `${resourcePath}/${dirEntry.name}`;
      const type = dirEntry.kind === "tree" ? "folder" : "file";
      const content =
        type === "file" ? worktree.readFile(toWorktreePath(childPath)).toString("utf-8") : "";
      entries.set(childPath, {
        path: childPath,
        type,
        name: dirEntry.name,
        parentPath: resourceParentPath(childPath),
        depth: resourceDepth(childPath),
        displayPath: childPath,
        order,
        content,
        hash: type === "file" ? sha1Text(content) : sha1Text(`folder:${childPath}`),
      });
      order += 1;

      if (type === "folder") {
        visit(childPath);
      }
    }
  };

  visit("");

  return { entries };
}

export function ensureChapterBodiesExist(
  worktree: VirtualWorktree,
  outline: ManuscriptOutline,
): void {
  for (const node of Object.values(outline.nodes)) {
    if (node.type !== "chapter") {
      continue;
    }
    const stat = worktree.stat(chapterBodyPath(node.id));
    if (stat?.kind !== "blob") {
      throw new Error(`Manuscript chapter body is missing: ${node.id}`);
    }
  }
}

export function verifyResourceTree(worktree: VirtualWorktree): void {
  if (!worktree.exists(RESOURCES_DIR)) {
    return;
  }

  const visit = (worktreePath: string): void => {
    const stat = worktree.stat(worktreePath);
    if (stat?.kind !== "tree") {
      throw new Error(`Resource path is not a folder: ${worktreePath}`);
    }
    for (const entry of worktree.readdir(worktreePath)) {
      const childPath = joinWorktreeChild(worktreePath, entry.name);
      if (entry.kind === "tree") {
        visit(childPath);
        continue;
      }
      if (entry.kind !== "blob") {
        throw new Error(`Unsupported resource entry kind: ${entry.kind}`);
      }
      const childStat = worktree.stat(childPath);
      if (childStat?.kind !== "blob") {
        throw new Error(`Resource file is not readable: ${childPath}`);
      }
    }
  };

  visit(RESOURCES_DIR);
}
