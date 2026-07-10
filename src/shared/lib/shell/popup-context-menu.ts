import { windowService } from "#app/shared/lib/rpc/app-rpc";
import type { ContextMenuItem } from "#shared/rpc/context-menu";

/**
 * Popup a native Electron context menu at content-relative coordinates.
 * Returns the chosen leaf item id, or `null` if dismissed / empty.
 */
export async function popupContextMenu(
  items: ContextMenuItem[],
  position: { x: number; y: number },
): Promise<string | null> {
  if (items.length === 0) {
    return null;
  }
  return windowService.popupContextMenu(items, position.x, position.y);
}
