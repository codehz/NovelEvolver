import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useId, useRef, type RefObject } from "react";

import { cn } from "@/lib/cn";
import {
  activeNotificationsAtom,
  notificationApi,
  notificationCenterOpenAtom,
} from "@/lib/notifications";

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
    function onPointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (anchorRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, open, setOpen]);

  if (!open) {
    return null;
  }

  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div
      ref={panelRef}
      aria-labelledby={titleId}
      className={cn(centerPanelPositionClass, notificationPanelClass)}
      role="dialog"
    >
      <header className="flex items-center justify-between border-b border-notification-border px-3 py-2">
        <h2 id={titleId} className="font-medium text-app-foreground">
          通知
        </h2>
        {sorted.length > 0 ? (
          <button
            className="text-notification-action hover:underline"
            type="button"
            onClick={() => {
              notificationApi.closeAll();
            }}
          >
            全部清除
          </button>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-3 py-6 text-center text-workbench-status-bar-muted">没有通知</p>
        ) : (
          sorted.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} variant="center" />
          ))
        )}
      </div>
    </div>
  );
}
