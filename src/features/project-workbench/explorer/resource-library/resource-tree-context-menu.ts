import type { ContextMenuItem } from "#shared/rpc/context-menu";
import type { ResourceTreeNode } from "#shared/rpc/worktree-tree-rpc";

export type ResourceTreeContextAction = "open" | "new-file" | "new-folder" | "rename" | "delete";

export function buildResourceTreeContextMenuItems(options: {
  type: ResourceTreeNode["type"];
  isRoot: boolean;
}): ContextMenuItem[] {
  const { type, isRoot } = options;
  if (type === "file") {
    return [
      { id: "open", label: "打开" },
      { type: "separator" },
      { id: "rename", label: "重命名" },
      { id: "delete", label: "删除" },
    ];
  }

  const items: ContextMenuItem[] = [
    { id: "new-file", label: "新建文件" },
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
