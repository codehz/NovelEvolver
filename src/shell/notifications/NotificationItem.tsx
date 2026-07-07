import { motion, type MotionProps } from "motion/react";
import type { Ref } from "react";

import type { AppNotification } from "#app/shared/lib/notifications";
import { notificationApi } from "#app/shared/lib/notifications";
import { cn } from "#app/shared/lib/ui/cn";

import {
  notificationActionButtonClass,
  notificationCenterItemDividerClass,
  notificationIconButtonClass,
  notificationSeverityIconClass,
  notificationToastClass,
} from "./notification-chrome";

const variantMotionMap: Record<"toast" | "center", MotionProps> = {
  toast: {
    initial: { opacity: 0, y: -12, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  },
  center: {
    initial: { opacity: 0, marginBlock: 0 },
    animate: { opacity: 1, marginBlock: 0 },
    exit: { opacity: 0, marginBlock: 0 },
    transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  },
};

export type NotificationItemProps = {
  notification: AppNotification;
  variant: "toast" | "center";
  ref?: Ref<HTMLElement>;
};

export function NotificationItem({ notification, variant, ref }: NotificationItemProps) {
  const { id, severity, message, source, actions, progress } = notification;
  const hasSource = source != null && source.length > 0;
  const hasProgressBar = severity === "progress" && progress != null;
  const isCompactRow = !hasSource && !hasProgressBar && actions.length === 0;

  return (
    <motion.article
      ref={ref}
      className={cn(
        "group flex gap-2 p-3",
        isCompactRow ? "items-center" : "items-start",
        variant === "center" && notificationCenterItemDividerClass,
        variant === "toast" && notificationToastClass,
      )}
      layout="position"
      layoutId={notification.id}
      {...variantMotionMap[variant]}
      role={severity === "error" ? "alert" : "status"}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center text-base",
          notificationSeverityIconClass[severity],
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="min-w-0">
          {hasSource ? <p className="text-app-muted">{source}</p> : null}
          <p className={cn("wrap-break-word text-app-foreground", isCompactRow && "leading-6")}>
            {message}
          </p>
          {severity === "progress" && progress != null ? (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-badge-background">
              <div
                className="h-full bg-badge-background transition-[width] duration-200"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          ) : null}
        </div>
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {actions.map((action) => (
              <button
                key={action.id}
                className={notificationActionButtonClass}
                type="button"
                onClick={() => {
                  notificationApi.runAction(id, action.id);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        aria-label="关闭通知"
        className={cn(
          notificationIconButtonClass,
          "text-ctp-mauve opacity-0 transition-opacity duration-150",
          "group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100",
        )}
        type="button"
        onClick={() => {
          notificationApi.close(id);
        }}
      >
        <span aria-hidden="true" className="icon-[codicon--close] text-sm" />
      </button>
    </motion.article>
  );
}
