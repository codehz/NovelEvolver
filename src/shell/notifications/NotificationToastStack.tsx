import { useAtomValue } from "jotai";
import { AnimatePresence } from "motion/react";

import { toastNotificationsAtom } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";

import { NotificationItem } from "./NotificationItem";

const toastStackClass = cn(
  "pointer-events-none fixed right-3 bottom-[2.215rem] z-notification flex min-w-notification-panel flex-col gap-2",
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
