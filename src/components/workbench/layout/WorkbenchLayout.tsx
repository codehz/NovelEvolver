import { useMemo, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { cn } from "#app/lib/cn";

import { TitleBarAuxiliaryToggle } from "../titlebar/TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "../titlebar/TitleBarPrimarySidebarToggle";
import type { WorkbenchPrimaryView } from "../types";
import { ActivityBar } from "./ActivityBar";
import { AuxiliarySidebarDock } from "./AuxiliarySidebarDock";
import { PrimarySidebarDock } from "./PrimarySidebarDock";
import { PrimarySidebarViewStack } from "./PrimarySidebarViewStack";
import { useMeasuredElementWidth } from "./use-measured-element-width";
import { useWorkbenchActiveView } from "./use-workbench-active-view";
import { useWorkbenchLayoutPreferences } from "./use-workbench-layout-preferences";
import { useWorkbenchSidebarResize } from "./use-workbench-sidebar-resize";
import {
  ACTIVITY_BAR_WIDTH,
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  MIN_EDITOR_WIDTH,
  deriveWorkbenchChromeLayout,
} from "./workbench-layout-resolver";

const resizeHandleClass = cn(
  "absolute inset-y-0 z-20 w-1 cursor-col-resize touch-none bg-ctp-mauve select-none",
  "opacity-0 transition-opacity delay-0 duration-150",
  "hover:opacity-100 hover:delay-300 focus-visible:opacity-100 focus-visible:delay-150",
);

function ResizeHandle({
  active,
  ariaLabel,
  position,
  onPointerDown,
}: {
  active: boolean;
  ariaLabel: string;
  position: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      className={cn(resizeHandleClass, active && "opacity-100")}
      role="separator"
      style={{ left: position }}
      onPointerDown={onPointerDown}
    />
  );
}

export type WorkbenchLayoutProps = {
  primaryViews: readonly WorkbenchPrimaryView[];
  editor: ReactNode;
  auxiliary?: ReactNode;
  defaultActiveViewId?: string;
};

export function WorkbenchLayout({
  primaryViews,
  editor,
  auxiliary,
  defaultActiveViewId,
}: WorkbenchLayoutProps) {
  const hasAuxiliary = auxiliary != null;
  const hasPrimaryViews = primaryViews.length > 0;
  const { layoutPreferences, setLayoutPreferences, toggleAuxiliarySidebar } =
    useWorkbenchLayoutPreferences({
      hasAuxiliary,
      hasPrimaryViews,
    });
  const { activePrimaryView, activeViewId, handlePrimarySidebarToggle, handleSelectView } =
    useWorkbenchActiveView({
      defaultActiveViewId,
      primaryViews,
      setLayoutPreferences,
    });
  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth<HTMLDivElement>(
    ACTIVITY_BAR_WIDTH + DEFAULT_PRIMARY_WIDTH + DEFAULT_AUXILIARY_WIDTH + MIN_EDITOR_WIDTH,
  );
  const chromeLayout = deriveWorkbenchChromeLayout({
    layoutPreferences,
    containerWidth,
    canShowPrimary: hasPrimaryViews && activePrimaryView != null,
    hasAuxiliary,
  });
  const {
    resolved: resolvedLayout,
    primary: primaryChrome,
    auxiliary: auxiliaryChrome,
  } = chromeLayout;
  const primarySidebarVisible = primaryChrome.visible;
  const primarySidebarPanelWidth = primaryChrome.panelWidth;
  const primarySidebarSpacerWidth = primaryChrome.spacerWidth;
  const auxiliaryVisible = auxiliaryChrome.visible;
  const auxiliarySidebarPanelWidth = auxiliaryChrome.panelWidth;
  const auxiliarySidebarSpacerWidth = auxiliaryChrome.spacerWidth;
  const { activeResizeSide, startResizeDrag } = useWorkbenchSidebarResize({
    hasAuxiliary,
    layoutPreferences,
    resolvedLayout,
    setLayoutPreferences,
  });
  const activityItems = useMemo(
    () =>
      primaryViews.map((view) => ({
        id: view.id,
        label: view.title,
        iconClass: view.iconClass,
      })),
    [primaryViews],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {hasPrimaryViews ? (
        <TitleBarPrimarySidebarToggle
          visible={primarySidebarVisible}
          onToggle={() => handlePrimarySidebarToggle(primarySidebarVisible)}
        />
      ) : null}
      {hasAuxiliary ? (
        <TitleBarAuxiliaryToggle
          visible={auxiliaryVisible}
          onToggle={() => toggleAuxiliarySidebar(auxiliaryVisible)}
        />
      ) : null}
      <div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar
          items={activityItems}
          activeView={activeViewId}
          primarySidebarVisible={primarySidebarVisible}
          onSelectView={(viewId) => handleSelectView(viewId, primarySidebarVisible)}
        />
        {hasPrimaryViews ? (
          <PrimarySidebarDock
            panelWidth={primarySidebarPanelWidth}
            resizeTransitionDisabled={activeResizeSide === "primary"}
            spacerWidth={primarySidebarSpacerWidth}
            title={activePrimaryView?.title ?? primaryViews[0]!.title}
            visible={primarySidebarVisible}
          >
            <PrimarySidebarViewStack activeViewId={activeViewId} views={primaryViews} />
          </PrimarySidebarDock>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{editor}</div>
        {hasAuxiliary ? (
          <AuxiliarySidebarDock
            panelWidth={auxiliarySidebarPanelWidth}
            resizeTransitionDisabled={activeResizeSide === "auxiliary"}
            spacerWidth={auxiliarySidebarSpacerWidth}
            visible={auxiliaryVisible}
          >
            {auxiliary}
          </AuxiliarySidebarDock>
        ) : null}
        {primarySidebarVisible ? (
          <ResizeHandle
            active={activeResizeSide === "primary"}
            ariaLabel="调整主侧边栏宽度"
            position={ACTIVITY_BAR_WIDTH + primaryChrome.spacerWidth}
            onPointerDown={(event) => startResizeDrag("primary", event)}
          />
        ) : null}
        {auxiliaryVisible ? (
          <ResizeHandle
            active={activeResizeSide === "auxiliary"}
            ariaLabel="调整辅助侧边栏宽度"
            position={containerWidth - auxiliaryChrome.spacerWidth - 1}
            onPointerDown={(event) => startResizeDrag("auxiliary", event)}
          />
        ) : null}
      </div>
    </div>
  );
}
