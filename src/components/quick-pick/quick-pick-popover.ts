import { createPopover } from "@/components/popover";

export const [
  QuickPickPopoverProvider,
  QuickPickPopoverTarget,
  QuickPickPopoverContent,
  useQuickPickRequestClose,
] = createPopover("QuickPick");
