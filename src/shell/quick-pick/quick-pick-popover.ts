import { createPopover } from "#app/shared/ui/popover";

export const [QuickPickPopoverProvider, QuickPickPopoverTarget, useQuickPickRequestClose] =
  createPopover("QuickPick");
