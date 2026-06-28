import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { cn } from "../../lib/cn";

/** Layout flow height at the section seam (handle is overlaid, not counted in flex). */
export const SIDEBAR_SECTION_RESIZE_STRIP_HEIGHT = 0;
export const SIDEBAR_SECTION_HEADER_HEIGHT_PX = 24;

const sectionHeaderButtonClass = cn(
  "flex h-6 min-w-0 flex-1 items-center gap-0.5 bg-workbench-panel-header px-1.5 text-left text-xs font-semibold tracking-wide text-workbench-sidebar-title uppercase",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

const sectionHeaderChevronClass = cn(
  "inline-flex size-3 shrink-0 items-center justify-center text-sm leading-none",
);

const sectionHeaderActionClass = cn(
  "inline-flex size-5 shrink-0 items-center justify-center rounded border-0 bg-transparent p-0",
  "text-workbench-sidebar-title",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-badge-background",
);

const sectionHeaderActionIconClass = cn(
  "inline-flex size-3 shrink-0 items-center justify-center text-sm leading-none",
);

const sectionResizeSeamClass = cn("relative z-20 h-0 shrink-0");

/** Narrow hit target: ~4px above the seam, ~4px below; rail on the seam (upper side). */
const sectionResizeHandleClass = cn(
  "group absolute inset-x-0 top-0 z-20 h-2 -translate-y-1 cursor-row-resize touch-none select-none",
);

const sectionResizeRailClass = cn(
  "h-1 w-full shrink-0 bg-workbench-sidebar-title opacity-0 transition-opacity delay-0 duration-150",
  "group-hover:opacity-100 group-hover:delay-300 group-focus-visible:opacity-100 group-focus-visible:delay-150",
);

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
  headerActions,
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
  headerActions?: ReactNode;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn("flex min-h-0 flex-col", bodyFillsSection && expanded && "min-h-0 flex-1")}
      style={sectionStyle}
    >
      <div className="flex shrink-0 items-center">
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          className={sectionHeaderButtonClass}
          type="button"
          onClick={onToggleExpanded}
        >
          <span
            aria-hidden="true"
            className={cn(
              sectionHeaderChevronClass,
              expanded ? "icon-[codicon--chevron-down]" : "icon-[codicon--chevron-right]",
            )}
          />
          <span className="truncate">{title}</span>
        </button>
        {headerActions ?? (
          <button
            aria-label={`${title} 视图操作`}
            className={cn(sectionHeaderActionClass, "mr-0.5")}
            type="button"
          >
            <span
              aria-hidden="true"
              className={cn(sectionHeaderActionIconClass, "icon-[codicon--ellipsis]")}
            />
          </button>
        )}
      </div>
      {expanded ? (
        <div
          className={cn(
            "min-h-0 overflow-auto",
            bodyFillsSection ? "h-0 flex-1" : undefined,
          )}
          id={panelId}
          style={bodyStyle}
        >
          {children}
        </div>
      ) : null}
    </section>
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
    <div className={sectionResizeSeamClass}>
      <div
        aria-label={ariaLabel}
        aria-orientation="horizontal"
        className={sectionResizeHandleClass}
        role="separator"
        onPointerDown={onPointerDown}
      >
        <div
          className={cn(sectionResizeRailClass, "absolute inset-x-0 bottom-1", active && "opacity-100")}
        />
      </div>
    </div>
  );
}