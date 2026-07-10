import type { ContextMenuItem } from "#app/shared/lib/context-menu";
import type { ManuscriptTreeNode } from "#shared/rpc/worktree-tree-rpc";

export type ManuscriptTreeContextAction =
  | "open"
  | "new-chapter"
  | "new-folder"
  | "rename"
  | "delete";

export function buildManuscriptTreeContextMenuItems(options: {
  type: ManuscriptTreeNode["type"];
  isRoot: boolean;
}): ContextMenuItem[] {
  const { type, isRoot } = options;
  if (type === "chapter") {
    return [
      { id: "open", label: "打开" },
      { type: "separator" },
      { id: "rename", label: "重命名" },
      { id: "delete", label: "删除" },
    ];
  }

  const items: ContextMenuItem[] = [
    { id: "new-chapter", label: "新建章节" },
    { id: "new-folder", label: "新建文件夹" },
  ];
  if (!isRoot) {
    items.push(
      { type: "separator" },
      { id: "rename", label: "重命名" },
      {
        id: "delete",
        label: "删除",
      },
    );
  }
  return items;
}
