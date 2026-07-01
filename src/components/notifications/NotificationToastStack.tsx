import { useAtomValue } from "jotai";
import { AnimatePresence } from "motion/react";

import { cn } from "#app/lib/cn";
import { toastNotificationsAtom } from "#app/lib/notifications";

import { NotificationItem } from "./NotificationItem";

const toastStackClass = cn(
  "pointer-events-none fixed right-notification-edge-inset bottom-notification-above-statusbar z-notification flex min-w-notification-panel flex-col gap-2",
);

export function NotificationToastStack() {
  const toasts = useAtomValue(toastNotificationsAtom);

  return (
    <div aria-live="polite" className={toastStackClass}>
      <AnimatePresence mode="popLayout">
        {toasts.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} variant="toast" />
        ))}
      </AnimatePresence>
    </div>
  );
}
