import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/notifications";
import { notificationApi } from "@/lib/notifications";

import {
  notificationActionButtonClass,
  notificationCloseButtonClass,
  notificationSeverityIconClass,
} from "./notification-chrome";

export type NotificationItemProps = {
  notification: AppNotification;
  variant: "toast" | "center";
};

export function NotificationItem({ notification, variant }: NotificationItemProps) {
  const { id, severity, message, source, actions, progress } = notification;

  return (
    <article
      className={cn(
        "flex gap-2 p-3",
        variant === "center" && "border-b border-notification-border last:border-b-0",
      )}
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
    </article>
  );
}
