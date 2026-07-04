import { resourceBaseName, resourceParentPath } from "#shared/resource-library-path";
import type { ResourceTreeSnapshot } from "#shared/rpc/projects-rpc";

export function moveDestinationPath(sourcePath: string, targetPath: string): string {
  const sourceName = resourceBaseName(sourcePath);
  return targetPath === "" ? sourceName : `${targetPath}/${sourceName}`;
}

/**
 * 判断将 `sourcePath`（类型 `sourceType`）移动到 `targetPath` 是否合法。
 * 返回 `true` 表示非法（应被禁用、不高亮、不执行）。
 *
 * 非法情形：
 * 1. 目标不是文件夹。
 * 2. 目标与源相同。
 * 3. 源为文件夹且目标是其后代。
 * 4. 目标就是源的当前父目录（移动后路径不变，无意义）。
 * 5. 移动后的最终路径已存在。
 */
export function isInvalidDropTarget(
  snapshot: ResourceTreeSnapshot,
  sourcePath: string,
  sourceType: "file" | "folder",
  targetPath: string,
): boolean {
  if (snapshot.nodes[targetPath]?.type !== "folder") {
    return true;
  }
  if (targetPath === sourcePath) {
    return true;
  }
  if (sourceType === "folder" && targetPath.startsWith(`${sourcePath}/`)) {
    return true;
  }
  const sourceParent = resourceParentPath(sourcePath);
  if (targetPath === sourceParent) {
    return true;
  }
  if (snapshot.nodes[moveDestinationPath(sourcePath, targetPath)] !== undefined) {
    return true;
  }
  return false;
}

/**
 * 给定指针命中的目标行信息（从 DOM `data-tree-row-id` / `data-tree-row-type` 读取），
 * 解析出有效放置目标 path。
 *
 * - 文件夹行 → 目标为该文件夹 path。
 * - 文件行 → 目标为其父文件夹 path。
 * - 任何非法目标（见 {@link isInvalidDropTarget}）→ 返回 `null`。
 */
export function resolveDropTargetFromRow(
  snapshot: ResourceTreeSnapshot,
  targetRowPath: string,
  targetRowType: "file" | "folder",
  sourcePath: string,
  sourceType: "file" | "folder",
): string | null {
  const candidate = targetRowType === "folder" ? targetRowPath : resourceParentPath(targetRowPath);
  if (isInvalidDropTarget(snapshot, sourcePath, sourceType, candidate)) {
    return null;
  }
  return candidate;
}
