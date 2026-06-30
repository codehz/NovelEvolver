import { useAtom, useAtomValue } from "jotai";
import { useCallback, useId, useRef } from "react";

import { StatusBarItemButton } from "@/components/workbench";
import { activeNotificationsAtom, notificationCenterOpenAtom } from "@/lib/notifications";

import { notificationBellAnchorClass } from "./notification-chrome";
import {
  NotificationCenterPopoverProvider,
  useNotificationCenterRequestClose,
} from "./notification-popover";
import { NotificationCenterPopoverPanel } from "./NotificationCenterOverlay";
import { NotificationCenterPanel } from "./NotificationCenterPanel";

function NotificationBellStatusButton({
  open,
  hasNotifications,
  onClick,
}: {
  open: boolean;
  hasNotifications: boolean;
  onClick: () => void;
}) {
  return (
    <StatusBarItemButton
      aria-controls="app-notification-center"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={hasNotifications ? "通知，有待查看项" : "通知"}
      icon={hasNotifications ? "icon-[codicon--bell-dot]" : "icon-[codicon--bell]"}
      type="button"
      onClick={onClick}
    />
  );
}

function NotificationCenterOpenShell({ onDismiss }: { onDismiss: () => void }) {
  const requestClose = useNotificationCenterRequestClose();
  const activeNotifications = useAtomValue(activeNotificationsAtom);
  const hasNotifications = activeNotifications.length > 0;
  const titleId = useId();

  return (
    <>
      <NotificationBellStatusButton
        open
        hasNotifications={hasNotifications}
        onClick={() => {
          requestClose(onDismiss);
        }}
      />
      <NotificationCenterPopoverPanel titleId={titleId}>
        <NotificationCenterPanel titleId={titleId} />
      </NotificationCenterPopoverPanel>
    </>
  );
}

export function NotificationBellButton() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useAtom(notificationCenterOpenAtom);
  const activeNotifications = useAtomValue(activeNotificationsAtom);
  const hasNotifications = activeNotifications.length > 0;
  const dismiss = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <div ref={anchorRef} className={notificationBellAnchorClass}>
      {open ? (
        <NotificationCenterPopoverProvider onDismiss={dismiss}>
          <NotificationCenterOpenShell onDismiss={dismiss} />
        </NotificationCenterPopoverProvider>
      ) : (
        <NotificationBellStatusButton
          open={false}
          hasNotifications={hasNotifications}
          onClick={() => {
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}
