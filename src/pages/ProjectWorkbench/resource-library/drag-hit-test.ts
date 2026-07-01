function parentPath(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash) : "";
}

/**
 * 判断将 `sourcePath`（类型 `sourceType`）移动到 `targetPath` 是否合法。
 * 返回 `true` 表示非法（应被禁用、不高亮、不执行）。
 *
 * 非法情形：
 * 1. 目标与源相同（`to === sourcePath`）。
 * 2. 源为文件夹且目标是其自身或后代（`to === sourcePath || to.startsWith(sourcePath + "/")`）。
 * 3. 目标就是源的当前父目录（移动后路径不变，无意义）。
 */
export function isInvalidDropTarget(
  sourcePath: string,
  sourceType: "file" | "folder",
  targetPath: string,
): boolean {
  if (targetPath === sourcePath) {
    return true;
  }
  if (sourceType === "folder" && targetPath.startsWith(`${sourcePath}/`)) {
    return true;
  }
  const sourceParent = parentPath(sourcePath);
  if (targetPath === sourceParent) {
    return true;
  }
  return false;
}

/**
 * 给定指针命中的目标行信息（从 DOM `data-row-path` / `data-row-type` 读取），
 * 解析出有效放置目标 path。
 *
 * - 文件夹行 → 目标为该文件夹 path。
 * - 文件行 → 目标为其父文件夹 path。
 * - 任何非法目标（见 {@link isInvalidDropTarget}）→ 返回 `null`。
 */
export function resolveDropTargetFromRow(
  targetRowPath: string,
  targetRowType: "file" | "folder",
  sourcePath: string,
  sourceType: "file" | "folder",
): string | null {
  const candidate = targetRowType === "folder" ? targetRowPath : parentPath(targetRowPath);
  if (isInvalidDropTarget(sourcePath, sourceType, candidate)) {
    return null;
  }
  return candidate;
}
