import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { ScrollArea } from "#app/components/ScrollArea";
import { cn } from "#app/lib/cn";

import {
  sidebarSectionHeaderButtonClass,
  sidebarSectionHeaderChevronClass,
  sidebarSectionResizeHandleClass,
  sidebarSectionResizeRailClass,
  sidebarSectionResizeSeamClass,
} from "./sidebar-chrome";
import {
  SidebarSectionActionsPortalProvider,
  SidebarSectionActionsPortalTarget,
} from "./sidebar-section-actions-portal";

/** Layout flow height at the section seam (handle is overlaid, not counted in flex). */
export const SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT = 0;
export const SIDEBAR_SECTION_HEADER_HEIGHT_PX = 24;

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
}: {
  title: string;
  ariaLabel: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  panelId: string;
  children: ReactNode;
  sectionStyle?: CSSProperties;
  bodyStyle?: CSSProperties;
  bodyFillsSection?: boolean;
}) {
  return (
    <SidebarSectionActionsPortalProvider>
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
          <SidebarSectionActionsPortalTarget as="div" className="flex shrink-0 items-center" />
        </div>
        {expanded ? (
          <ScrollArea fill={bodyFillsSection} id={panelId} style={bodyStyle}>
            {children}
          </ScrollArea>
        ) : null}
      </section>
    </SidebarSectionActionsPortalProvider>
  );
}

export function SidebarSectionRowResizeHandle({
  active,
  ariaLabel,
  onPointerDown,
}: {
  active: boolean;
  ariaLabel: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
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
