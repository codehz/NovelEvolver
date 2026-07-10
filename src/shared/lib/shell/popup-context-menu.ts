import { contextMenuApi, type ContextMenuItem } from "#app/shared/lib/context-menu";

/**
 * Popup a VS Code-style HTML context menu at viewport coordinates.
 * Returns the chosen leaf item id, or `null` if dismissed / empty.
 */
export async function popupContextMenu(
  items: ContextMenuItem[],
  position: { x: number; y: number },
): Promise<string | null> {
  return contextMenuApi.show(items, position);
}
