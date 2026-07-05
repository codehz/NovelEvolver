import type { SHA1 } from "nano-git";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { ManuscriptOutline, ManuscriptNode } from "#shared/rpc/projects-rpc";
import type { DiffItem, DiffItemKind, DiffStats } from "#shared/rpc/worktree-diff";

import {
  type ObjectDatabase,
  readTextFromTree,
  buildParentMap,
  buildAncestorPath,
  computeDepth,
  computeStats,
  computeLCS,
  chapterBodyPath,
  MANUSCRIPT_OUTLINE_PATH,
  parseOutlineOrNull,
} from "./utils";

// ---- 内容比较辅助 ----

function chapterContentChanged(
  objects: ObjectDatabase,
  baseTree: SHA1,
  worktree: VirtualWorktree,
  id: string,
): boolean {
  const oldContent = readTextFromTree(objects, baseTree, chapterBodyPath(id)) ?? "";
  const bodyPath = chapterBodyPath(id);
  const newContent = worktree.exists(bodyPath) ? worktree.readFile(bodyPath).toString("utf-8") : "";
  return oldContent !== newContent;
}

function computeChapterStats(
  objects: ObjectDatabase,
  baseTree: SHA1,
  worktree: VirtualWorktree,
  id: string,
): DiffStats {
  const oldContent = readTextFromTree(objects, baseTree, chapterBodyPath(id)) ?? "";
  const bodyPath = chapterBodyPath(id);
  const newContent = worktree.exists(bodyPath) ? worktree.readFile(bodyPath).toString("utf-8") : "";
  return computeStats(oldContent, newContent);
}

function computeDeletedBodyStats(
  objects: ObjectDatabase,
  baseTree: SHA1,
  id: string,
): DiffStats | undefined {
  const content = readTextFromTree(objects, baseTree, chapterBodyPath(id));
  if (content === null || content === "") return undefined;
  return { added: 0, removed: content.length };
}

function computeNewBodyStats(worktree: VirtualWorktree, id: string): DiffStats | undefined {
  const bodyPath = chapterBodyPath(id);
  const content = worktree.exists(bodyPath) ? worktree.readFile(bodyPath).toString("utf-8") : "";
  if (content.length === 0) return undefined;
  return { added: content.length, removed: 0 };
}

// ---- Reorder 分解 ----

function decomposeReorder(
  baseChildren: string[],
  currentChildren: string[],
  baseNodes: Record<string, ManuscriptNode>,
  currentNodes: Record<string, ManuscriptNode>,
  baseParentById: Map<string, string | null>,
  currentParentById: Map<string, string | null>,
  folderId: string,
  rootTitle: string,
): DiffItem[] {
  const validBefore = baseChildren.filter((id) => currentNodes[id] !== undefined);
  const lcs = computeLCS(validBefore, currentChildren);
  const lcsSet = new Set(lcs);

  const items: DiffItem[] = [];

  // after 中不在 LCS 中的项 = 新增 / 移入的项
  for (let i = 0; i < currentChildren.length; i++) {
    const childId = currentChildren[i];
    if (lcsSet.has(childId)) continue;

    const node = currentNodes[childId];
    if (node === undefined) continue;

    const depth = computeDepth(folderId, currentParentById);
    const rawPath = buildAncestorPath(childId, currentParentById, currentNodes);
    const path =
      rootTitle !== "" && rawPath.startsWith(rootTitle + "/")
        ? rawPath.slice(rootTitle.length + 1)
        : rawPath;

    items.push({
      revertId: `reorder:${folderId}:${childId}`,
      kind: "reorder",
      path,
      depth,
      label: node.title,
      isDir: node.type === "folder",
      reorderInfo: { childId, folderId, before: validBefore },
    });
  }

  // before 中不在 LCS 中的项 = 被删除 / 移出的项
  for (const childId of validBefore) {
    if (lcsSet.has(childId)) continue;

    const node = baseNodes[childId];
    if (node === undefined) continue;

    const depth = computeDepth(folderId, baseParentById);
    const rawPath = buildAncestorPath(childId, baseParentById, baseNodes);
    const path =
      rootTitle !== "" && rawPath.startsWith(rootTitle + "/")
        ? rawPath.slice(rootTitle.length + 1)
        : rawPath;

    items.push({
      revertId: `reorder:${folderId}:${childId}`,
      kind: "reorder",
      path,
      depth,
      label: node.title,
      isDir: node.type === "folder",
      reorderInfo: { childId, folderId, before: validBefore },
    });
  }

  return items;
}

// ==================== 主计算函数 ====================

/**
 * 计算正文（manuscript）的 diff，输出扁平 DiffItem 列表。
 */
export function computeManuscriptDiffItems(
  objects: ObjectDatabase,
  worktree: VirtualWorktree,
  baseTree: SHA1,
  baseOutline: ManuscriptOutline | null,
): DiffItem[] {
  let currentOutline: ManuscriptOutline | null = null;
  if (worktree.exists(MANUSCRIPT_OUTLINE_PATH)) {
    const content = worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8");
    currentOutline = parseOutlineOrNull(content);
  }

  if (baseOutline === null && currentOutline === null) return [];

  const baseNodes = baseOutline?.nodes ?? {};
  const currentNodes = currentOutline?.nodes ?? {};
  const baseParentById = baseOutline !== null ? buildParentMap(baseOutline) : new Map();
  const currentParentById = currentOutline !== null ? buildParentMap(currentOutline) : new Map();
  const ROOT_ID = "root";
  const allIds = new Set(
    [...Object.keys(baseNodes), ...Object.keys(currentNodes)].filter((id) => id !== ROOT_ID),
  );

  // 根节点标题（用于从路径中剥离）
  const rootTitle = baseNodes[ROOT_ID]?.title ?? currentNodes[ROOT_ID]?.title ?? "";

  const items: DiffItem[] = [];

  for (const id of allIds) {
    const baseNode = baseNodes[id] ?? null;
    const currentNode = currentNodes[id] ?? null;

    // 删除节点
    if (baseNode !== null && currentNode === null) {
      const depth = computeDepth(id, baseParentById) - 1;
      const rawPath = buildAncestorPath(id, baseParentById, baseNodes);
      const path =
        rootTitle !== "" && rawPath.startsWith(rootTitle + "/")
          ? rawPath.slice(rootTitle.length + 1)
          : rawPath;
      const isDir = baseNode.type === "folder";
      const stats = !isDir ? computeDeletedBodyStats(objects, baseTree, id) : undefined;

      items.push({
        revertId: `node:${id}`,
        kind: "remove",
        path,
        depth,
        label: baseNode.title,
        stats,
        isDir,
      });
      continue;
    }

    // 新增节点
    if (baseNode === null && currentNode !== null) {
      const depth = computeDepth(id, currentParentById) - 1;
      const rawPath = buildAncestorPath(id, currentParentById, currentNodes);
      const path =
        rootTitle !== "" && rawPath.startsWith(rootTitle + "/")
          ? rawPath.slice(rootTitle.length + 1)
          : rawPath;
      const isDir = currentNode.type === "folder";
      const stats = !isDir ? computeNewBodyStats(worktree, id) : undefined;

      items.push({
        revertId: `node:${id}`,
        kind: "add",
        path,
        depth,
        label: currentNode.title,
        stats,
        isDir,
      });
      continue;
    }

    // 两边都存在
    if (baseNode === null || currentNode === null) continue;

    const baseParent = baseParentById.get(id) ?? null;
    const currentParent = currentParentById.get(id) ?? null;
    const hasTitleChange = baseNode.title !== currentNode.title;
    const hasParentChange = baseParent !== currentParent;
    const hasContentChange =
      currentNode.type === "chapter" &&
      baseNode.type === "chapter" &&
      chapterContentChanged(objects, baseTree, worktree, id);
    const hasChildrenChange =
      currentNode.type === "folder" &&
      baseNode.type === "folder" &&
      (baseNode.children.length !== currentNode.children.length ||
        baseNode.children.some((c, i) => c !== currentNode.children[i]));

    const hasAnyChange = hasTitleChange || hasParentChange || hasContentChange || hasChildrenChange;
    if (!hasAnyChange) continue;

    const depth = computeDepth(id, currentParentById) - 1;
    const rawPath = buildAncestorPath(id, currentParentById, currentNodes);
    const path =
      rootTitle !== "" && rawPath.startsWith(rootTitle + "/")
        ? rawPath.slice(rootTitle.length + 1)
        : rawPath;
    const isDir = currentNode.type === "folder";

    const kind: DiffItemKind =
      hasParentChange && !hasTitleChange && !hasContentChange ? "move" : "modify";
    const stats = hasContentChange
      ? computeChapterStats(objects, baseTree, worktree, id)
      : undefined;

    items.push({
      revertId: `node:${id}`,
      kind,
      path,
      depth,
      label: currentNode.title,
      stats,
      isDir,
    });

    // children 变更 → 分解为独立 reorder items
    if (hasChildrenChange && currentNode.type === "folder" && baseNode.type === "folder") {
      items.push(
        ...decomposeReorder(
          baseNode.children,
          currentNode.children,
          baseNodes,
          currentNodes,
          baseParentById,
          currentParentById,
          id,
          rootTitle,
        ),
      );
    }
  }

  items.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  return items;
}
