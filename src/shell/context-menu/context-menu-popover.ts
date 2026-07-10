import { createPopover } from "#app/shared/ui/popover";

export const [
  ContextMenuPopoverProvider,
  ContextMenuPopoverTarget,
  ContextMenuPopoverContent,
  useContextMenuRequestClose,
] = createPopover("ContextMenu");
