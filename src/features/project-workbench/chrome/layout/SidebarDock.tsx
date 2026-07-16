import {
  memo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { SlotText } from "#app/shared/ui";

import { sidebarChromeTitleTextClass } from "../sidebar/sidebar-chrome";
import { SidebarResizeSash } from "./SidebarResizeSash";
import { WORKBENCH_SIDEBAR_INSET, sidebarChromeOuterSize } from "./workbench-layout-resolver";

const sidebarDockMotionClass = cn("duration-200 ease-out");

const sidebarDockSpacerClass = cn(
  "pointer-events-none h-full min-h-0 shrink-0",
  "transition-[width]",
  sidebarDockMotionClass,
);

const sidebarDockChromeBaseClass = cn(
  "absolute top-0 bottom-0 overflow-visible",
  "transition-opacity will-change-[opacity]",
  sidebarDockMotionClass,
);

const sidebarDockPanelClass = cn("absolute top-0 bottom-0 overflow-hidden");

const sidebarDockSashClass = cn("absolute top-0 bottom-0");

const sidebarDockTitleOverlayClass = cn(
  "pointer-events-none absolute inset-x-0 top-0 z-20 flex h-workbench-tab items-center pr-3 pl-5",
);

type SidebarDockSide = "primary" | "auxiliary";

type SidebarDockProps = {
  side: SidebarDockSide;
  visible: boolean;
  spacerWidth: number;
  panelWidth: number;
  resizeTransitionDisabled: boolean;
  resizeActive: boolean;
  resizeAriaLabel: string;
  /** When set, paints a dock-level SlotText overlay over the panel header. */
  title?: string;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
};

export const SidebarDock = memo(function SidebarDock({
  side,
  visible,
  spacerWidth,
  panelWidth,
  resizeTransitionDisabled,
  resizeActive,
  resizeAriaLabel,
  title,
  onResizePointerDown,
  children,
}: SidebarDockProps) {
  const isPrimary = side === "primary";
  const spacerStyle: CSSProperties = { width: spacerWidth };
  // Dock owns panel + sash only; workbench row owns the right window-edge gap.
  const chromeStyle: CSSProperties = {
    width: sidebarChromeOuterSize(panelWidth),
  };
  const panelStyle: CSSProperties = isPrimary
    ? { left: 0, width: panelWidth }
    : { right: 0, width: panelWidth };
  const sashStyle: CSSProperties = isPrimary
    ? { left: panelWidth, width: WORKBENCH_SIDEBAR_INSET }
    : { left: 0, width: WORKBENCH_SIDEBAR_INSET };

  const sash = (
    <div className={sidebarDockSashClass} style={sashStyle}>
      <SidebarResizeSash
        active={resizeActive}
        ariaLabel={resizeAriaLabel}
        onPointerDown={onResizePointerDown}
      />
    </div>
  );

  const panel = (
    <div className={sidebarDockPanelClass} style={panelStyle}>
      {title !== undefined ? (
        <div aria-hidden="true" className={sidebarDockTitleOverlayClass}>
          <SlotText text={title} className={sidebarChromeTitleTextClass} />
        </div>
      ) : null}
      {children}
    </div>
  );

  return (
    <div
      className={cn(
        "relative h-full min-h-0 shrink-0 overflow-visible",
        // Primary sits before the editor in DOM; keep fade-out chrome above the editor.
        // Below activity bar `z-30`. Auxiliary is after the editor so stacking is free.
        isPrimary && "z-20",
      )}
    >
      <div
        aria-hidden
        className={cn(sidebarDockSpacerClass, resizeTransitionDisabled && "transition-none")}
        style={spacerStyle}
      />
      <div
        className={cn(
          sidebarDockChromeBaseClass,
          isPrimary ? "left-0" : "right-0 z-0",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={chromeStyle}
      >
        {isPrimary ? (
          <>
            {panel}
            {sash}
          </>
        ) : (
          <>
            {sash}
            {panel}
          </>
        )}
      </div>
    </div>
  );
});
