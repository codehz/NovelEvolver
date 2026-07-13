import { createPopover } from "#app/shared/ui/popover";

export const [
  NotificationCenterPopoverProvider,
  NotificationCenterPopoverTarget,
  useNotificationCenterRequestClose,
] = createPopover("NotificationCenter");
