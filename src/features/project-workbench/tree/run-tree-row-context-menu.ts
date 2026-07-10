import { popupContextMenu } from "#app/shared/lib/shell/popup-context-menu";
import type { ContextMenuItem } from "#shared/rpc/context-menu";

/**
 * Select the row, show a native context menu, then dispatch the chosen item id.
 * Returns the chosen id (or null if dismissed).
 */
export async function runTreeRowContextMenu(options: {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onBeforeOpen: () => void;
  onSelect: (id: string) => void | Promise<void>;
}): Promise<string | null> {
  if (options.items.length === 0) {
    return null;
  }
  options.onBeforeOpen();
  const id = await popupContextMenu(options.items, options.position);
  if (id === null) {
    return null;
  }
  await options.onSelect(id);
  return id;
}
