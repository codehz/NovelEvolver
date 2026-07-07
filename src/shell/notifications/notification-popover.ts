import { createPopover } from "#app/shared/ui/popover";

export const [
  NotificationCenterPopoverProvider,
  NotificationCenterPopoverTarget,
  NotificationCenterPopoverContent,
  useNotificationCenterRequestClose,
] = createPopover("NotificationCenter");
