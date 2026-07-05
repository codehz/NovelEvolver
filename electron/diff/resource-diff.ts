import type { SHA1 } from "nano-git";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { DiffItem, DiffStats } from "#shared/rpc/worktree-diff";

import {
  type ObjectDatabase,
  readTextFromTree,
  computeStats,
  toWorktreePath,
  RESOURCES_DIR,
  joinWorktreeChild,
  ensureResourcesDirectory,
} from "./utils";

// ---- 辅助函数 ----

function computeRemovedResourceStats(
  objects: ObjectDatabase,
  baseTree: SHA1,
  path: string,
): DiffStats | undefined {
  const content = readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, path)) ?? "";
  if (content === "") return undefined;
  return { added: 0, removed: content.length };
}

function computeAddedResourceStats(worktree: VirtualWorktree, path: string): DiffStats | undefined {
  const wPath = toWorktreePath(path);
  const content = worktree.readFile(wPath).toString("utf-8");
  if (content.length === 0) return undefined;
  return { added: content.length, removed: 0 };
}

// ==================== 主计算函数 ====================

/**
 * 计算资源（resources/）的 diff，输出扁平 DiffItem 列表。
 */
export function computeResourceDiffItems(
  objects: ObjectDatabase,
  worktree: VirtualWorktree,
  baseTree: SHA1,
  baseResourcePaths: Set<string>,
): DiffItem[] {
  ensureResourcesDirectory(worktree);
  const items: DiffItem[] = [];
  const resolveWtPath = (p: string) => toWorktreePath(p);

  const currentPaths = new Set<string>();
  const visitDirectory = (rpcPath: string): void => {
    const wPath = resolveWtPath(rpcPath);
    const dirEntries = worktree.readdir(wPath);
    for (const entry of dirEntries) {
      if (entry.kind !== "blob" && entry.kind !== "tree") continue;
      const childPath = rpcPath === "" ? entry.name : `${rpcPath}/${entry.name}`;
      currentPaths.add(childPath);
      if (entry.kind === "tree") {
        visitDirectory(childPath);
      }
    }
  };
  visitDirectory("");

  // base 中有、current 中无 → removed
  for (const basePath of baseResourcePaths) {
    if (currentPaths.has(basePath)) continue;

    const isDir = [...baseResourcePaths].some(
      (p) => p !== basePath && p.startsWith(basePath + "/"),
    );
    const segments = basePath.split("/");
    const depth = segments.length - 1;
    const label = segments[segments.length - 1];
    const stats = !isDir ? computeRemovedResourceStats(objects, baseTree, basePath) : undefined;

    items.push({
      revertId: `resource:${basePath}`,
      kind: "remove",
      path: basePath,
      depth,
      label,
      stats,
      isDir,
    });
  }

  // current 中有、base 中无 → added
  for (const currentPath of currentPaths) {
    if (baseResourcePaths.has(currentPath)) continue;

    const isDir = [...currentPaths].some(
      (p) => p !== currentPath && p.startsWith(currentPath + "/"),
    );
    const segments = currentPath.split("/");
    const depth = segments.length - 1;
    const label = segments[segments.length - 1];
    const stats = !isDir ? computeAddedResourceStats(worktree, currentPath) : undefined;

    items.push({
      revertId: `resource:${currentPath}`,
      kind: "add",
      path: currentPath,
      depth,
      label,
      stats,
      isDir,
    });
  }

  // 两边都有 → 检查内容
  for (const path of currentPaths) {
    if (baseResourcePaths.has(path)) continue;
    const isDir = [...currentPaths].some((p) => p !== path && p.startsWith(path + "/"));
    if (isDir) continue;

    const oldContent =
      readTextFromTree(objects, baseTree, joinWorktreeChild(RESOURCES_DIR, path)) ?? "";
    const newContent = worktree.readFile(resolveWtPath(path)).toString("utf-8");
    if (oldContent === newContent) continue;

    const segments = path.split("/");
    const depth = segments.length - 1;
    const label = segments[segments.length - 1];

    items.push({
      revertId: `resource:${path}`,
      kind: "modify",
      path,
      depth,
      label,
      stats: computeStats(oldContent, newContent),
      isDir: false,
    });
  }

  items.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  return items;
}
