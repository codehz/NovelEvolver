import { useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type RefObject } from "react";

import { cn } from "@/lib/cn";
import {
  activeNotificationsAtom,
  notificationApi,
  notificationCenterOpenAtom,
} from "@/lib/notifications";

import { ScrollArea } from "../ScrollArea";
import { notificationPanelClass } from "./notification-chrome";
import { NotificationItem } from "./NotificationItem";

const centerPanelPositionClass = cn(
  "absolute right-0 bottom-full z-notification mb-1 min-w-notification-panel",
);

export function NotificationCenterPanel({
  anchorRef,
}: {
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const open = useAtomValue(notificationCenterOpenAtom);
  const setOpen = useSetAtom(notificationCenterOpenAtom);
  const items = useAtomValue(activeNotificationsAtom);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    notificationApi.dismissAllToasts();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          aria-labelledby={titleId}
          className={cn(centerPanelPositionClass, notificationPanelClass)}
          role="dialog"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
          layout
        >
          <motion.header
            layout
            className="flex items-center justify-between border-b border-notification-border px-3 py-2"
          >
            <h2 id={titleId} className="font-medium text-app-foreground">
              通知
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
          </motion.header>
          <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence initial={false} mode="popLayout">
              {items.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                  className="px-3 py-6 text-center text-workbench-status-bar-muted"
                >
                  没有通知
                </motion.p>
              ) : (
                items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    variant="center"
                  />
                ))
              )}
            </AnimatePresence>
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
