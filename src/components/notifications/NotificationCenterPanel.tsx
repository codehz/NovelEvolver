import { useAtomValue } from "jotai";
import { AnimatePresence } from "motion/react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { activeNotificationsAtom, notificationApi } from "@/lib/notifications";

import { ScrollArea } from "../ScrollArea";
import { notificationIconButtonClass } from "./notification-chrome";
import { useNotificationCenterRequestClose } from "./notification-popover";
import { NotificationItem } from "./NotificationItem";

export function NotificationCenterPanel({
  titleId,
  onDismiss,
}: {
  titleId: string;
  onDismiss: () => void;
}) {
  const items = useAtomValue(activeNotificationsAtom);
  const requestClose = useNotificationCenterRequestClose();

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
          <button
            className={cn(
              notificationIconButtonClass,
              items.length > 0
                ? "text-notification-action"
                : "cursor-not-allowed text-workbench-status-bar-muted opacity-50",
            )}
            type="button"
            disabled={items.length === 0}
            onClick={() => {
              notificationApi.closeAll();
              requestClose(onDismiss);
            }}
            aria-label="全部清除"
          >
            <span aria-hidden="true" className="icon-[codicon--clear-all] text-sm" />
          </button>
          <button
            className={cn(notificationIconButtonClass, "text-notification-action")}
            type="button"
            onClick={() => {
              requestClose(onDismiss);
            }}
            aria-label="关闭"
          >
            <span aria-hidden="true" className="icon-[codicon--chevron-down] text-sm" />
          </button>
        </div>
      </header>
      <ScrollArea fill className="min-h-0 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} variant="center" />
          ))}
        </AnimatePresence>
      </ScrollArea>
    </>
  );
}
