import { useAtomValue } from "jotai";
import { AnimatePresence } from "motion/react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { activeNotificationsAtom, notificationApi } from "@/lib/notifications";

import { ScrollArea } from "../ScrollArea";
import { NotificationItem } from "./NotificationItem";

export function NotificationCenterPanel({ titleId }: { titleId: string }) {
  const items = useAtomValue(activeNotificationsAtom);

  useEffect(() => {
    notificationApi.dismissAllToasts();
  }, []);

  return (
    <>
      <header className="flex items-center justify-between px-3 py-2">
        <h2 id={titleId} className="font-medium text-app-foreground">
          {items.length === 0 ? "无新通知" : "通知"}
        </h2>
        <button
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-sm px-1 text-base",
            items.length > 0
              ? "text-notification-action hover:bg-window-button-hover"
              : "cursor-not-allowed text-workbench-status-bar-muted opacity-50",
          )}
          type="button"
          disabled={items.length === 0}
          onClick={() => {
            notificationApi.closeAll();
          }}
          aria-label="全部清除"
        >
          <span aria-hidden="true" className="icon-[codicon--clear-all]" />
        </button>
      </header>
      {items.length > 0 && (
        <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                variant="center"
              />
            ))}
          </AnimatePresence>
        </ScrollArea>
      )}
    </>
  );
}
