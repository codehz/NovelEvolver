import { createPopover } from "#app/shared/ui/popover";

export const [
  SettingsPopoverProvider,
  SettingsPopoverTarget,
  SettingsPopoverContent,
  useSettingsRequestClose,
] = createPopover("Settings");
