/**
 * Serializable native context-menu template (Electron Menu subset, S2).
 * Leaf items must carry a stable `id` returned by `WindowService.popupContextMenu`.
 * Submenu is limited to one level of nested items (no further `submenu`).
 */

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
  /** One level only — nested entries must be leaves or separators. */
  submenu: Array<ContextMenuLeafItem | ContextMenuSeparatorItem>;
};

export type ContextMenuItem =
  | ContextMenuLeafItem
  | ContextMenuSeparatorItem
  | ContextMenuSubmenuItem;
