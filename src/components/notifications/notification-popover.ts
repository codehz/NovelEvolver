import { createPopover } from "#app/components/popover";

export const [
  NotificationCenterPopoverProvider,
  NotificationCenterPopoverTarget,
  NotificationCenterPopoverContent,
  useNotificationCenterRequestClose,
] = createPopover("NotificationCenter");
