import { useRef, type ReactNode } from "react";

import { AnimatedShellHeightProvider, useAnimatedContentHeight } from "@/lib/animated-height";

import {
  notificationCenterPopoverPanelClass,
  notificationPanelContentClass,
  notificationPanelHeightShellClass,
} from "./notification-chrome";
import {
  NotificationCenterPopoverContent,
  NotificationCenterPopoverTarget,
} from "./notification-popover";

export function NotificationCenterPopoverPanel({
  titleId,
  children,
}: {
  titleId: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { heightPx: shellHeightPx, isHeightAnimating } = useAnimatedContentHeight(
    contentRef,
    panelRef,
  );

  return (
    <NotificationCenterPopoverTarget
      ref={panelRef}
      popover="manual"
      id="app-notification-center"
      aria-labelledby={titleId}
      className={notificationCenterPopoverPanelClass}
      role="dialog"
    >
      <div
        className={notificationPanelHeightShellClass}
        style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
      >
        <div ref={contentRef} className={notificationPanelContentClass}>
          <AnimatedShellHeightProvider isShellHeightAnimating={isHeightAnimating}>
            <NotificationCenterPopoverContent>{children}</NotificationCenterPopoverContent>
          </AnimatedShellHeightProvider>
        </div>
      </div>
    </NotificationCenterPopoverTarget>
  );
}
