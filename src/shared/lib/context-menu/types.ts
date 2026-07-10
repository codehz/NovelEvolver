export type ContextMenuLeafItem = {
  type?: "normal";
  id: string;
  label: string;
  enabled?: boolean;
  accelerator?: string;
};

export type ContextMenuSeparatorItem = {
  type: "separator";
};

export type ContextMenuSubmenuItem = {
  type?: "normal";
  label: string;
  enabled?: boolean;
  submenu: ContextMenuItem[];
};

export type ContextMenuItem =
  | ContextMenuLeafItem
  | ContextMenuSeparatorItem
  | ContextMenuSubmenuItem;

export type ContextMenuPosition = {
  x: number;
  y: number;
};

export type ContextMenuSession = {
  requestId: string;
  items: ContextMenuItem[];
  position: ContextMenuPosition;
};

export function isContextMenuSeparator(item: ContextMenuItem): item is ContextMenuSeparatorItem {
  return item.type === "separator";
}

export function isContextMenuSubmenu(item: ContextMenuItem): item is ContextMenuSubmenuItem {
  return !isContextMenuSeparator(item) && "submenu" in item;
}

export function isContextMenuLeaf(item: ContextMenuItem): item is ContextMenuLeafItem {
  return !isContextMenuSeparator(item) && !isContextMenuSubmenu(item);
}
