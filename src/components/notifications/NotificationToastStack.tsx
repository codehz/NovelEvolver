import { useAtomValue } from "jotai";

import { cn } from "@/lib/cn";
import { toastNotificationsAtom } from "@/lib/notifications";

import { notificationToastClass } from "./notification-chrome";
import { NotificationItem } from "./NotificationItem";

const toastStackClass = cn(
  "pointer-events-none fixed right-3 bottom-notification-above-statusbar z-notification flex flex-col gap-2",
);

export function NotificationToastStack() {
  const toasts = useAtomValue(toastNotificationsAtom);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className={toastStackClass}>
      {toasts.map((notification) => (
        <div key={notification.id} className={notificationToastClass}>
          <NotificationItem notification={notification} variant="toast" />
        </div>
      ))}
    </div>
  );
}
