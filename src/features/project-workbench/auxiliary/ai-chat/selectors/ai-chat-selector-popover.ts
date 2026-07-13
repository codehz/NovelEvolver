import { createPopover } from "#app/shared/ui/popover";

export const [
  AiChatSelectorPopoverProvider,
  AiChatSelectorPopoverTarget,
  useAiChatSelectorRequestClose,
] = createPopover("AiChatSelector");
