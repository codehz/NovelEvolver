import { createPopover } from "#app/shared/ui/popover";

export const [
  AiChatSelectorPopoverProvider,
  AiChatSelectorPopoverTarget,
  AiChatSelectorPopoverContent,
  useAiChatSelectorRequestClose,
] = createPopover("AiChatSelector");
