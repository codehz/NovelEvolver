import { memo, type CSSProperties, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { AuxiliarySidebarFrame } from "./AuxiliarySidebarFrame";

const auxiliarySidebarDockMotionClass = cn("duration-200 ease-out");

const auxiliarySidebarDockHostClass = cn("relative h-full min-h-0 shrink-0 overflow-visible");

const auxiliarySidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  auxiliarySidebarDockMotionClass,
);

const auxiliarySidebarDockPanelClass = cn(
  "absolute inset-y-0 right-0 z-0 overflow-hidden",
  "transition-transform will-change-transform",
  auxiliarySidebarDockMotionClass,
);

export const AuxiliarySidebarDock = memo(function AuxiliarySidebarDock({
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  children,
}: {
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  children?: ReactNode;
}) {
  const spacerStyle: CSSProperties = { width: spacerWidth };
  const panelStyle: CSSProperties = {
    width: panelWidth,
    transform: visible ? "translateX(0)" : "translateX(100%)",
  };

  return (
    <div className={auxiliarySidebarDockHostClass}>
      <div
        aria-hidden
        className={cn(
          auxiliarySidebarDockSpacerClass,
          resizeTransitionDisabled && "transition-none",
        )}
        style={spacerStyle}
      />
      <div
        className={cn(
          auxiliarySidebarDockPanelClass,
          resizeTransitionDisabled && "transition-none",
          !visible && "pointer-events-none",
        )}
        style={panelStyle}
      >
        <AuxiliarySidebarFrame aria-hidden={!visible} className="h-full min-h-0">
          {children}
        </AuxiliarySidebarFrame>
      </div>
    </div>
  );
});
