import { motion, type MotionProps } from "motion/react";
import type { Ref } from "react";

import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/notifications";
import { notificationApi } from "@/lib/notifications";

import {
  notificationActionButtonClass,
  notificationCloseButtonClass,
  notificationSeverityIconClass,
  notificationToastClass,
} from "./notification-chrome";

const variantMotionMap: Record<"toast" | "center", MotionProps> = {
  toast: {
    layout: true,
    initial: { opacity: 0, y: -12, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  },
  center: {},
};

export type NotificationItemProps = {
  notification: AppNotification;
  variant: "toast" | "center";
  ref?: Ref<HTMLElement>;
};

export function NotificationItem({ notification, variant, ref }: NotificationItemProps) {
  const { id, severity, message, source, actions, progress } = notification;

  return (
    <motion.article
      ref={ref}
      className={cn(
        "flex gap-2 p-3",
        variant === "center" && "border-b border-notification-border last:border-b-0",
        variant === "toast" && notificationToastClass,
      )}
      {...variantMotionMap[variant]}
      role={severity === "error" ? "alert" : "status"}
    >
      <span
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0 text-base", notificationSeverityIconClass[severity])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="min-w-0">
          {source != null && source.length > 0 ? (
            <p className="text-workbench-status-bar-muted">{source}</p>
          ) : null}
          <p className="wrap-break-word text-app-foreground">{message}</p>
          {severity === "progress" && progress != null ? (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-notification-border">
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
      <div className="flex shrink-0 flex-col gap-0.5">
        <button
          aria-label="关闭通知"
          className={notificationCloseButtonClass}
          type="button"
          onClick={() => {
            notificationApi.close(id);
          }}
        >
          <span aria-hidden="true" className="icon-[codicon--close] text-sm" />
        </button>
      </div>
    </motion.article>
  );
}
