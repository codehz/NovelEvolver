import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import {
  sidebarSectionHeaderButtonClass,
  sidebarSectionHeaderChevronClass,
  sidebarSectionResizeHandleClass,
  sidebarSectionResizeRailClass,
  sidebarSectionResizeSeamClass,
} from "./sidebar-chrome";
import {
  SidebarHeaderActionsPortalProvider,
  SidebarHeaderActionsPortalTarget,
} from "./sidebar-header-actions-portal";

/** Layout flow height at the section seam (handle is overlaid, not counted in flex). */
export const SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT = 0;
export const SIDEBAR_SECTION_HEADER_HEIGHT_PX = 24;

/** Flex child that consumes remaining section height and scrolls. */
const sidebarSectionBodyFillClass = cn("h-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto");
/** Sized body (inline `style.height`) that scrolls within its fixed height. */
const sidebarSectionBodyStretchClass = cn("h-full min-h-0 overflow-x-hidden overflow-y-auto");

type SidebarViewSectionProps = {
  title: string;
  ariaLabel: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  panelId: string;
  children: ReactNode;
  sectionStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  bodyFillsSection?: boolean;
};

export function SidebarViewSection({
  title,
  ariaLabel,
  expanded,
  onToggleExpanded,
  panelId,
  children,
  sectionStyle,
  bodyStyle,
  bodyFillsSection,
}: SidebarViewSectionProps) {
  return (
    <SidebarHeaderActionsPortalProvider>
      <section
        aria-label={ariaLabel}
        className={cn("flex min-h-0 flex-col", bodyFillsSection && expanded && "min-h-0 flex-1")}
        style={sectionStyle}
      >
        <div className="flex shrink-0 items-center pr-3">
          <button
            aria-controls={panelId}
            aria-expanded={expanded}
            className={sidebarSectionHeaderButtonClass}
            type="button"
            onClick={onToggleExpanded}
          >
            <span
              aria-hidden="true"
              className={cn(
                sidebarSectionHeaderChevronClass,
                expanded ? "icon-[codicon--chevron-down]" : "icon-[codicon--chevron-right]",
              )}
            />
            <span className="truncate">{title}</span>
          </button>
          <SidebarHeaderActionsPortalTarget as="div" className="flex shrink-0 items-center" />
        </div>
        {expanded ? (
          <div
            id={panelId}
            className={
              bodyFillsSection ? sidebarSectionBodyFillClass : sidebarSectionBodyStretchClass
            }
            style={bodyStyle}
          >
            {children}
          </div>
        ) : null}
      </section>
    </SidebarHeaderActionsPortalProvider>
  );
}

type SidebarSectionRowResizeHandleProps = {
  active: boolean;
  ariaLabel: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export function SidebarSectionRowResizeHandle({
  active,
  ariaLabel,
  onPointerDown,
}: SidebarSectionRowResizeHandleProps) {
  return (
    <div className={sidebarSectionResizeSeamClass}>
      <div
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={sidebarSectionResizeHandleClass}
        role="separator"
        onPointerDown={onPointerDown}
      >
        <div
          className={cn(
            sidebarSectionResizeRailClass,
            "absolute inset-x-0 bottom-1",
            active && "opacity-100",
          )}
        />
      </div>
    </div>
  );
}
