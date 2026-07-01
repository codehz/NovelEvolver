import { createPopover } from "#app/components/popover";

export const [
  QuickPickPopoverProvider,
  QuickPickPopoverTarget,
  QuickPickPopoverContent,
  useQuickPickRequestClose,
] = createPopover("QuickPick");
