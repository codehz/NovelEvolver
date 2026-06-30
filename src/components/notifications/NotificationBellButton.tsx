import { useAtom, useAtomValue } from "jotai";
import { useRef } from "react";

import { StatusBarItemButton } from "@/components/workbench";
import { activeNotificationsAtom, notificationCenterOpenAtom } from "@/lib/notifications";

import { NotificationCenterPanel } from "./NotificationCenterPanel";

export function NotificationBellButton() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useAtom(notificationCenterOpenAtom);
  const activeNotifications = useAtomValue(activeNotificationsAtom);
  const hasNotifications = activeNotifications.length > 0;

  return (
    <div ref={anchorRef} className="relative flex shrink-0 items-stretch self-stretch">
      <StatusBarItemButton
        aria-controls="app-notification-center"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={hasNotifications ? "通知，有待查看项" : "通知"}
        icon={hasNotifications ? "icon-[codicon--bell-dot]" : "icon-[codicon--bell]"}
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
      />
      <NotificationCenterPanel anchorRef={anchorRef} />
    </div>
  );
}
