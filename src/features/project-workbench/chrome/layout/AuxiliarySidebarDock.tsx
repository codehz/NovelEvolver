import { memo, type CSSProperties, type ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { AuxiliarySidebarFrame } from "./AuxiliarySidebarFrame";
import { WORKBENCH_SIDEBAR_INSET } from "./workbench-layout-resolver";

const auxiliarySidebarDockMotionClass = cn("duration-200 ease-out");

const auxiliarySidebarDockHostClass = cn("relative h-full min-h-0 shrink-0 overflow-visible");

const auxiliarySidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  auxiliarySidebarDockMotionClass,
);

const auxiliarySidebarDockPanelClass = cn(
  "absolute z-0 overflow-hidden",
  "transition-opacity will-change-[opacity]",
  auxiliarySidebarDockMotionClass,
);

type AuxiliarySidebarDockProps = {
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  children?: ReactNode;
};

export const AuxiliarySidebarDock = memo(function AuxiliarySidebarDock({
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  children,
}: AuxiliarySidebarDockProps) {
  const spacerStyle: CSSProperties = { width: spacerWidth };
  const panelStyle: CSSProperties = {
    top: 0,
    right: WORKBENCH_SIDEBAR_INSET,
    bottom: 0,
    width: panelWidth,
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
          visible ? "opacity-100" : "pointer-events-none opacity-0",
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
