import type { SHA1 } from "nano-git";
import { readObject } from "nano-git/objects";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";
import type { VirtualWorktree } from "nano-git/worktree/core";

import type { ManuscriptOutline, ManuscriptNode } from "#shared/rpc/projects-rpc";
import type { DiffStats } from "#shared/rpc/worktree-diff";

import { chapterBodyPath, MANUSCRIPT_OUTLINE_PATH } from "../manuscript-path";
import {
  toWorktreePath,
  RESOURCES_DIR,
  ensureResourcesDirectory,
  joinWorktreeChild,
} from "../resource-library-path";

/** ObjectDatabase 类型（nano-git 未公开导出，从 readTreeSnapshot 参数推导） */
export type ObjectDatabase = Parameters<typeof readTreeSnapshot>[0];

// ==================== Git Tree 读取 ====================

export function readFileFromTree(
  objects: ObjectDatabase,
  treeHash: SHA1,
  filePath: string,
): Buffer | undefined {
  const segments = filePath.split("/");
  let hash: SHA1 = treeHash;

  for (let i = 0; i < segments.length; i++) {
    let obj;
    try {
      obj = readObject(objects, hash);
    } catch {
      return undefined;
    }
    if (obj.type !== "tree") return undefined;

    const entry = obj.entries.find((e) => e.name === segments[i]);
    if (entry === undefined) return undefined;

    if (i === segments.length - 1) {
      let blob;
      try {
        blob = readObject(objects, entry.hash);
      } catch {
        return undefined;
      }
      return blob.type === "blob" ? blob.content : undefined;
    }
    hash = entry.hash;
  }
  return undefined;
}

export function readTextFromTree(
  objects: ObjectDatabase,
  treeHash: SHA1,
  path: string,
): string | null {
  const buf = readFileFromTree(objects, treeHash, path);
  return buf !== undefined ? buf.toString("utf-8") : null;
}

// ==================== Outline 辅助 ====================

export function buildParentMap(outline: ManuscriptOutline): Map<string, string | null> {
  const parentById = new Map<string, string | null>();
  for (const [id, node] of Object.entries(outline.nodes)) {
    if (node.type === "folder") {
      for (const childId of node.children) {
        parentById.set(childId, id);
      }
    }
  }
  if (!parentById.has(outline.rootId)) {
    parentById.set(outline.rootId, null);
  }
  return parentById;
}

export function parseOutlineOrNull(content: string | null): ManuscriptOutline | null {
  if (content === null) return null;
  try {
    const parsed = JSON.parse(content) as ManuscriptOutline;
    if (
      parsed.version === 1 &&
      parsed.rootId === "root" &&
      typeof parsed.nodes === "object" &&
      parsed.nodes !== null
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function buildAncestorPath(
  id: string,
  parentMap: Map<string, string | null>,
  nodeMap: Record<string, ManuscriptNode>,
): string {
  const segments: string[] = [];
  let current: string | undefined = id;
  const visited = new Set<string>();
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    const node = nodeMap[current];
    if (node !== undefined) {
      segments.unshift(node.title);
    }
    current = parentMap.get(current) ?? undefined;
  }
  return segments.join("/");
}

export function computeDepth(id: string, parentMap: Map<string, string | null>): number {
  let depth = 0;
  let current: string | undefined = id;
  const visited = new Set<string>();
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    const parent = parentMap.get(current);
    if (parent === undefined || parent === null) break;
    depth++;
    current = parent;
  }
  return depth;
}

// ==================== Diff Stats ====================

export function computeStats(oldContent: string, newContent: string): DiffStats {
  if (oldContent === newContent) {
    return { added: 0, removed: 0 };
  }
  if (oldContent === "") {
    return { added: newContent.length, removed: 0 };
  }
  if (newContent === "") {
    return { added: 0, removed: oldContent.length };
  }

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let added = 0;
  let removed = 0;
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      added += newLines[j - 1].length + 1;
      j--;
    } else {
      removed += oldLines[i - 1].length + 1;
      i--;
    }
  }

  return { added, removed };
}

export function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}

// ==================== Base 快照 ====================

export interface BaseSnapshot {
  outline: ManuscriptOutline | null;
  resourcePaths: Set<string>;
}

export function buildBaseSnapshot(objects: ObjectDatabase, treeHash: SHA1): BaseSnapshot {
  let snapshot;
  try {
    snapshot = readTreeSnapshot(objects, treeHash);
  } catch {
    return { outline: null, resourcePaths: new Set() };
  }

  const outlineContent = readTextFromTree(objects, treeHash, MANUSCRIPT_OUTLINE_PATH);
  const outline = parseOutlineOrNull(outlineContent);

  const resourcePaths = new Set<string>();
  for (const entry of snapshot) {
    if (entry.path.startsWith(`${RESOURCES_DIR}/`)) {
      const rel = entry.path.slice(RESOURCES_DIR.length + 1);
      if (rel !== "") {
        resourcePaths.add(rel);
      }
    }
  }

  return { outline, resourcePaths };
}

// ==================== Worktree / Path 辅助 ====================

export { ensureResourcesDirectory, joinWorktreeChild, toWorktreePath, RESOURCES_DIR };
export { chapterBodyPath, MANUSCRIPT_OUTLINE_PATH };

export function getWorktreeResourcePaths(worktree: VirtualWorktree): Set<string> {
  const paths = new Set<string>();
  ensureResourcesDirectory(worktree);
  const resolveWtPath = (p: string) => toWorktreePath(p);
  const visit = (rpcPath: string): void => {
    const wPath = resolveWtPath(rpcPath);
    const dirEntries = worktree.readdir(wPath);
    for (const entry of dirEntries) {
      if (entry.kind !== "blob" && entry.kind !== "tree") continue;
      const childPath = rpcPath === "" ? entry.name : `${rpcPath}/${entry.name}`;
      paths.add(childPath);
      if (entry.kind === "tree") visit(childPath);
    }
  };
  visit("");
  return paths;
}

export function getWorktreeOutline(worktree: VirtualWorktree): ManuscriptOutline | null {
  if (!worktree.exists(MANUSCRIPT_OUTLINE_PATH)) return null;
  const content = worktree.readFile(MANUSCRIPT_OUTLINE_PATH).toString("utf-8");
  return parseOutlineOrNull(content);
}
