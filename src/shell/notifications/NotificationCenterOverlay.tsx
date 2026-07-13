import { useRef, type ReactNode } from "react";

import { useAnimatedContentHeight } from "#app/shared/lib/ui/animated-height";

import {
  notificationPanelContentClass,
  notificationPanelHeightShellClass,
} from "./notification-chrome";

/** Animated height shell for the notification center body. */
export function NotificationCenterHeightShell({ children }: { children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { heightPx: shellHeightPx } = useAnimatedContentHeight(contentRef, panelRef);

  return (
    <div ref={panelRef}>
      <div
        className={notificationPanelHeightShellClass}
        style={shellHeightPx != null ? { height: shellHeightPx } : undefined}
      >
        <div ref={contentRef} className={notificationPanelContentClass}>
          {children}
        </div>
      </div>
    </div>
  );
}
