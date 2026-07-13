import { Popover } from "@base-ui/react/popover";
import { useAtomValue } from "jotai";
import { AnimatePresence } from "motion/react";
import { useEffect } from "react";

import { activeNotificationsAtom, notificationApi } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";

import { notificationIconButtonClass, notificationListScrollClass } from "./notification-chrome";
import { NotificationItem } from "./NotificationItem";

export function NotificationCenterPanel({ titleId }: { titleId: string }) {
  const items = useAtomValue(activeNotificationsAtom);

  useEffect(() => {
    notificationApi.dismissAllToasts();
  }, []);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between px-3 py-2">
        <h2 id={titleId} className="font-medium text-app-foreground">
          {items.length === 0 ? "无新通知" : "通知"}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Popover.Close
            className={cn(
              notificationIconButtonClass,
              items.length > 0 ? "text-ctp-mauve" : "cursor-not-allowed text-app-muted opacity-50",
            )}
            type="button"
            disabled={items.length === 0}
            onClick={() => {
              notificationApi.closeAll();
            }}
            aria-label="全部清除"
          >
            <span aria-hidden="true" className="icon-[codicon--clear-all] text-sm" />
          </Popover.Close>
          <Popover.Close
            className={cn(notificationIconButtonClass, "text-ctp-mauve")}
            type="button"
            aria-label="关闭"
          >
            <span aria-hidden="true" className="icon-[codicon--chevron-down] text-base" />
          </Popover.Close>
        </div>
      </header>
      <div className={notificationListScrollClass}>
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} variant="center" />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
