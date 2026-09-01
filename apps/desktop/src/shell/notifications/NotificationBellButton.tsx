import { Popover } from "@base-ui/react/popover";
import { useAtom, useAtomValue } from "jotai";
import { useId } from "react";

import { StatusBarItemButton } from "#app/features/project-workbench/chrome";
import { activeNotificationsAtom, notificationCenterOpenAtom } from "#app/shared/lib/notifications";

import {
  notificationBellAnchorClass,
  notificationCenterPopoverPanelClass,
  notificationCenterPositionerClass,
} from "./notification-chrome";
import { NotificationCenterHeightShell } from "./NotificationCenterOverlay";
import { NotificationCenterPanel } from "./NotificationCenterPanel";

export function NotificationBellButton() {
  const [open, setOpen] = useAtom(notificationCenterOpenAtom);
  const activeNotifications = useAtomValue(activeNotificationsAtom);
  const hasNotifications = activeNotifications.length > 0;
  const titleId = useId();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div className={notificationBellAnchorClass}>
        <Popover.Trigger
          render={
            <StatusBarItemButton
              aria-controls="app-notification-center"
              aria-haspopup="dialog"
              aria-label={hasNotifications ? "通知，有待查看项" : "通知"}
              icon={hasNotifications ? "icon-[codicon--bell-dot]" : "icon-[codicon--bell]"}
            />
          }
        />
      </div>
      <Popover.Portal>
        <Popover.Positioner
          className={notificationCenterPositionerClass}
          side="top"
          align="end"
          sideOffset={12}
          positionMethod="fixed"
        >
          <Popover.Popup
            id="app-notification-center"
            className={notificationCenterPopoverPanelClass}
            aria-labelledby={titleId}
          >
            <NotificationCenterHeightShell>
              <NotificationCenterPanel titleId={titleId} />
            </NotificationCenterHeightShell>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
