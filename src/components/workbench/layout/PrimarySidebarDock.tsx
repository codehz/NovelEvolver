import { memo, type CSSProperties, type ReactNode } from "react";

import { cn } from "#app/lib/cn";

import { PrimarySidebar } from "./PrimarySidebar";

const primarySidebarDockMotionClass = cn("duration-200 ease-out");

const primarySidebarDockHostClass = cn("relative h-full min-h-0 shrink-0 overflow-visible");

const primarySidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  primarySidebarDockMotionClass,
);

const primarySidebarDockPanelClass = cn(
  "absolute inset-y-0 left-0 z-0 overflow-hidden",
  "transition-transform will-change-transform",
  primarySidebarDockMotionClass,
);

export const PrimarySidebarDock = memo(function PrimarySidebarDock({
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  title,
  children,
}: {
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  title: string;
  children?: ReactNode;
}) {
  const spacerStyle: CSSProperties = { width: spacerWidth };
  const panelStyle: CSSProperties = {
    width: panelWidth,
    transform: visible ? "translateX(0)" : "translateX(-100%)",
  };

  return (
    <div className={primarySidebarDockHostClass}>
      <div
        aria-hidden
        className={cn(primarySidebarDockSpacerClass, resizeTransitionDisabled && "transition-none")}
        style={spacerStyle}
      />
      <div
        className={cn(
          primarySidebarDockPanelClass,
          resizeTransitionDisabled && "transition-none",
          !visible && "pointer-events-none",
        )}
        style={panelStyle}
      >
        <PrimarySidebar aria-hidden={!visible} className="h-full min-h-0" title={title}>
          {children}
        </PrimarySidebar>
      </div>
    </div>
  );
});
