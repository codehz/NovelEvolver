import { createPopover } from "#app/shared/ui/popover";

export const [ContextMenuPopoverProvider, ContextMenuPopoverTarget, useContextMenuRequestClose] =
  createPopover("ContextMenu");
