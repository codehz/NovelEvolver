import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "#app/lib/cn";

import { TitleBarAuxiliaryToggle } from "../titlebar/TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "../titlebar/TitleBarPrimarySidebarToggle";
import type { WorkbenchPrimaryView } from "../types";
import { ActivityBar } from "./ActivityBar";
import { AuxiliarySidebarDock } from "./AuxiliarySidebarDock";
import { PrimarySidebarDock } from "./PrimarySidebarDock";
import { PrimarySidebarViewStack } from "./PrimarySidebarViewStack";
import {
  ACTIVITY_BAR_WIDTH,
  CLOSE_SIDEBAR_THRESHOLD,
  DEFAULT_AUXILIARY_WIDTH,
  DEFAULT_PRIMARY_WIDTH,
  MIN_AUXILIARY_WIDTH,
  MIN_EDITOR_WIDTH,
  MIN_PRIMARY_WIDTH,
  deriveWorkbenchChromeLayout,
  normalizeSidebarWidth,
  snapshotLayoutPreferences,
  type LayoutPreferences,
  type ResizePriority,
} from "./workbench-layout-resolver";

type ResizeSide = ResizePriority;

const resizeHandleClass = cn(
  "absolute inset-y-0 z-20 w-1 cursor-col-resize touch-none bg-workbench-resize-handle select-none",
  "opacity-0 transition-opacity delay-0 duration-150",
  "hover:opacity-100 hover:delay-300 focus-visible:opacity-100 focus-visible:delay-150",
);

function resolveDefaultActiveViewId(
  primaryViews: readonly WorkbenchPrimaryView[],
  defaultActiveViewId?: string,
) {
  if (primaryViews.length === 0) {
    return null;
  }

  if (defaultActiveViewId) {
    const matchedView = primaryViews.find((view) => view.id === defaultActiveViewId);
    if (matchedView) {
      return matchedView.id;
    }
  }

  return primaryViews[0]!.id;
}

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
  const [activeViewId, setActiveViewId] = useState<string | null>(() =>
    resolveDefaultActiveViewId(primaryViews, defaultActiveViewId),
  );
  const [layoutPreferences, setLayoutPreferences] = useState<LayoutPreferences>({
    primaryVisible: primaryViews.length > 0,
    primaryWidth: DEFAULT_PRIMARY_WIDTH,
    auxiliaryVisible: auxiliary != null,
    auxiliaryWidth: DEFAULT_AUXILIARY_WIDTH,
    priority: "primary",
  });
  const [containerWidth, setContainerWidth] = useState(
    ACTIVITY_BAR_WIDTH + DEFAULT_PRIMARY_WIDTH + DEFAULT_AUXILIARY_WIDTH + MIN_EDITOR_WIDTH,
  );
  const [activeResizeSide, setActiveResizeSide] = useState<ResizeSide | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const hasAuxiliary = auxiliary != null;
  const hasPrimaryViews = primaryViews.length > 0;
  const activePrimaryView = primaryViews.find((view) => view.id === activeViewId) ?? null;
  const canShowPrimary = hasPrimaryViews && activePrimaryView != null;
  const chromeLayout = deriveWorkbenchChromeLayout({
    layoutPreferences,
    containerWidth,
    canShowPrimary,
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setContainerWidth(container.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setContainerWidth(Math.round(entry.contentRect.width));
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const nextActiveViewId =
      activeViewId != null && primaryViews.some((view) => view.id === activeViewId)
        ? activeViewId
        : resolveDefaultActiveViewId(primaryViews, defaultActiveViewId);

    if (nextActiveViewId !== activeViewId) {
      setActiveViewId(nextActiveViewId);
    }
  }, [activeViewId, defaultActiveViewId, primaryViews]);

  useEffect(() => {
    if (hasAuxiliary) {
      return;
    }

    setLayoutPreferences((value) =>
      value.auxiliaryVisible
        ? {
            ...value,
            auxiliaryVisible: false,
          }
        : value,
    );
  }, [hasAuxiliary]);

  useEffect(() => {
    if (hasPrimaryViews) {
      return;
    }

    setLayoutPreferences((value) =>
      value.primaryVisible
        ? {
            ...value,
            primaryVisible: false,
          }
        : value,
    );
  }, [hasPrimaryViews]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  function handleSelectView(viewId: string) {
    if (viewId === activeViewId && primarySidebarVisible) {
      setLayoutPreferences((value) => ({
        ...value,
        primaryVisible: false,
      }));
      return;
    }

    setActiveViewId(viewId);
    setLayoutPreferences((value) => ({
      ...value,
      primaryVisible: true,
      priority: "primary",
    }));
  }

  function handlePrimarySidebarToggle() {
    if (!hasPrimaryViews) {
      return;
    }

    if (activeViewId == null) {
      setActiveViewId(resolveDefaultActiveViewId(primaryViews, defaultActiveViewId));
    }

    setLayoutPreferences((value) => ({
      ...value,
      primaryVisible: !primarySidebarVisible,
      priority: "primary",
    }));
  }

  function startResizeDrag(side: ResizeSide, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragCleanupRef.current?.();

    const startX = event.clientX;
    const startLayout = snapshotLayoutPreferences(layoutPreferences, resolvedLayout, hasAuxiliary);

    setActiveResizeSide(side);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;

      setLayoutPreferences((value) => {
        if (side === "primary") {
          const nextPrimaryWidth = startLayout.primaryWidth + deltaX;
          const nextPrimaryVisible = nextPrimaryWidth >= CLOSE_SIDEBAR_THRESHOLD;

          return {
            ...value,
            priority: "primary",
            primaryVisible: nextPrimaryVisible,
            primaryWidth: normalizeSidebarWidth(nextPrimaryWidth, MIN_PRIMARY_WIDTH),
          };
        }

        const nextAuxiliaryWidth = startLayout.auxiliaryWidth - deltaX;
        const nextAuxiliaryVisible = nextAuxiliaryWidth >= CLOSE_SIDEBAR_THRESHOLD;

        return {
          ...value,
          priority: "auxiliary",
          auxiliaryVisible: nextAuxiliaryVisible,
          auxiliaryWidth: normalizeSidebarWidth(nextAuxiliaryWidth, MIN_AUXILIARY_WIDTH),
        };
      });
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setActiveResizeSide(null);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup, { once: true });
    window.addEventListener("pointercancel", cleanup, { once: true });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {hasPrimaryViews ? (
        <TitleBarPrimarySidebarToggle
          visible={primarySidebarVisible}
          onToggle={handlePrimarySidebarToggle}
        />
      ) : null}
      {hasAuxiliary ? (
        <TitleBarAuxiliaryToggle
          visible={auxiliaryVisible}
          onToggle={() =>
            setLayoutPreferences((value) => ({
              ...value,
              auxiliaryVisible: !auxiliaryVisible,
              priority: "auxiliary",
            }))
          }
        />
      ) : null}
      <div ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar
          items={primaryViews.map((view) => ({
            id: view.id,
            label: view.title,
            iconClass: view.iconClass,
          }))}
          activeView={activeViewId}
          primarySidebarVisible={primarySidebarVisible}
          onSelectView={handleSelectView}
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
