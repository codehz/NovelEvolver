import type { SHA1 } from "nano-git";
import { readObject } from "nano-git/objects";
import { readTreeSnapshot } from "nano-git/repository/tree/tree-diff";

import type { ScmChangeStats } from "#shared/rpc/worktree-scm-rpc";

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

// ==================== Diff Stats ====================

export function computeStats(oldContent: string, newContent: string): ScmChangeStats {
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
