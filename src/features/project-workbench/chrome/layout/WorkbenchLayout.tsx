import {
  useCallback,
  useMemo,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { TitleBarAuxiliaryToggle } from "../titlebar/TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "../titlebar/TitleBarPrimarySidebarToggle";
import type { WorkbenchPrimaryView } from "../types";
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
import { WorkbenchActivityBar } from "./WorkbenchActivityBar";

const resizeHandleClass = cn(
  "absolute inset-y-0 z-20 w-1 cursor-col-resize touch-none bg-ctp-mauve select-none",
  "opacity-0 transition-opacity delay-0 duration-150",
  "hover:opacity-100 hover:delay-300 focus-visible:opacity-100 focus-visible:delay-150",
);

type ResizeHandleProps = {
  active: boolean;
  ariaLabel: string;
  position: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function ResizeHandle({ active, ariaLabel, position, onPointerDown }: ResizeHandleProps) {
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
  auxiliary: ReactNode;
  defaultActiveViewId?: string;
};

export function WorkbenchLayout({
  primaryViews,
  editor,
  auxiliary,
  defaultActiveViewId,
}: WorkbenchLayoutProps) {
  if (primaryViews.length === 0) {
    throw new Error("WorkbenchLayout requires at least one primary view");
  }

  const { layoutPreferences, setLayoutPreferences, togglePrimarySidebar, toggleAuxiliarySidebar } =
    useWorkbenchLayoutPreferences();
  const { activePrimaryView, activeViewId, handleSelectView } = useWorkbenchActiveView({
    defaultActiveViewId,
    primaryViews,
    setLayoutPreferences,
  });
  const { ref: containerRef, width: containerWidth } = useMeasuredElementWidth<HTMLDivElement>(
    ACTIVITY_BAR_WIDTH + DEFAULT_PRIMARY_WIDTH + DEFAULT_AUXILIARY_WIDTH + MIN_EDITOR_WIDTH,
  );
  const {
    resolved: resolvedLayout,
    primary,
    auxiliary: auxiliaryChrome,
  } = useMemo(
    () =>
      deriveWorkbenchChromeLayout({
        layoutPreferences,
        containerWidth,
      }),
    [containerWidth, layoutPreferences],
  );
  const { activeResizeSide, startResizeDrag } = useWorkbenchSidebarResize({
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
  const handleActivitySelectView = useCallback(
    (viewId: string) => {
      handleSelectView(viewId, primary.visible);
    },
    [handleSelectView, primary.visible],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TitleBarPrimarySidebarToggle
        visible={primary.visible}
        onToggle={() => {
          togglePrimarySidebar(primary.visible);
        }}
      />
      <TitleBarAuxiliaryToggle
        visible={auxiliaryChrome.visible}
        onToggle={() => {
          toggleAuxiliarySidebar(auxiliaryChrome.visible);
        }}
      />
      <div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchActivityBar
          items={activityItems}
          activeView={activeViewId}
          primarySidebarVisible={primary.visible}
          onSelectView={handleActivitySelectView}
        />
        <PrimarySidebarDock
          panelWidth={primary.panelWidth}
          resizeTransitionDisabled={activeResizeSide === "primary"}
          spacerWidth={primary.spacerWidth}
          title={activePrimaryView.title}
          visible={primary.visible}
        >
          <PrimarySidebarViewStack activeViewId={activeViewId} views={primaryViews} />
        </PrimarySidebarDock>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{editor}</div>
        <AuxiliarySidebarDock
          panelWidth={auxiliaryChrome.panelWidth}
          resizeTransitionDisabled={activeResizeSide === "auxiliary"}
          spacerWidth={auxiliaryChrome.spacerWidth}
          visible={auxiliaryChrome.visible}
        >
          {auxiliary}
        </AuxiliarySidebarDock>
        {primary.visible ? (
          <ResizeHandle
            active={activeResizeSide === "primary"}
            ariaLabel="调整主侧边栏宽度"
            position={ACTIVITY_BAR_WIDTH + primary.spacerWidth}
            onPointerDown={(event) => {
              startResizeDrag("primary", event);
            }}
          />
        ) : null}
        {auxiliaryChrome.visible ? (
          <ResizeHandle
            active={activeResizeSide === "auxiliary"}
            ariaLabel="调整辅助侧边栏宽度"
            position={containerWidth - auxiliaryChrome.spacerWidth - 1}
            onPointerDown={(event) => {
              startResizeDrag("auxiliary", event);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
