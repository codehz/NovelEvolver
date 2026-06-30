import { useRef, type ReactNode } from "react";

import { notificationCenterPopoverPanelClass } from "./notification-chrome";
import {
  NotificationCenterPopoverContent,
  NotificationCenterPopoverTarget,
} from "./notification-popover";

export function NotificationCenterPopoverPanel({
  titleId,
  children,
}: {
  titleId: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <NotificationCenterPopoverTarget
      ref={panelRef}
      popover="manual"
      id="app-notification-center"
      aria-labelledby={titleId}
      className={notificationCenterPopoverPanelClass}
      role="dialog"
    >
      <NotificationCenterPopoverContent>{children}</NotificationCenterPopoverContent>
    </NotificationCenterPopoverTarget>
  );
}
