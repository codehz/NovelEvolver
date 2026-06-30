import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/cn";
import { toastNotificationsAtom } from "@/lib/notifications";

import { notificationToastClass } from "./notification-chrome";
import { NotificationItem } from "./NotificationItem";

const toastStackClass = cn(
  "pointer-events-none fixed right-3 bottom-notification-above-statusbar z-notification flex min-w-notification-panel flex-col gap-2",
);

export function NotificationToastStack() {
  const toasts = useAtomValue(toastNotificationsAtom);

  return (
    <div aria-live="polite" className={toastStackClass}>
      <AnimatePresence mode="popLayout">
        {toasts.map((notification) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
            className={notificationToastClass}
          >
            <NotificationItem notification={notification} variant="toast" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
