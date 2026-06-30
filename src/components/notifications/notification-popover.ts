import { createPopover } from "@/components/popover";

export const [
  NotificationCenterPopoverProvider,
  NotificationCenterPopoverTarget,
  NotificationCenterPopoverContent,
  useNotificationCenterRequestClose,
] = createPopover("NotificationCenter");
