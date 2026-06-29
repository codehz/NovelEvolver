import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { TitleBarAuxiliaryToggle } from "../titlebar/TitleBarAuxiliaryToggle";
import { TitleBarPrimarySidebarToggle } from "../titlebar/TitleBarPrimarySidebarToggle";
import type { ActivityViewId } from "../types";
import { ActivityBar } from "./ActivityBar";
import { AuxiliarySidebar } from "./AuxiliarySidebar";
import { PrimarySidebar } from "./PrimarySidebar";

const ACTIVITY_BAR_WIDTH = 48;
const DEFAULT_PRIMARY_WIDTH = 256;
const DEFAULT_AUXILIARY_WIDTH = 320;
const MIN_PRIMARY_WIDTH = 208;
const MIN_AUXILIARY_WIDTH = 240;
const CLOSE_SIDEBAR_THRESHOLD = 160;
const MIN_EDITOR_WIDTH = 520;

type ResizePriority = "primary" | "auxiliary";
type ResizeSide = ResizePriority;

type LayoutPreferences = {
  primaryVisible: boolean;
  primaryWidth: number;
  auxiliaryVisible: boolean;
  auxiliaryWidth: number;
  priority: ResizePriority;
};

type ResolvedWorkbenchLayout = {
  primaryVisible: boolean;
  primaryWidth: number;
  auxiliaryVisible: boolean;
  auxiliaryWidth: number;
};

const resizeHandleClass = cn(
  "absolute inset-y-0 z-20 w-1 cursor-col-resize touch-none bg-workbench-sidebar-title select-none",
  "opacity-0 transition-opacity delay-0 duration-150",
  "hover:opacity-100 hover:delay-300 focus-visible:opacity-100 focus-visible:delay-150",
);

function resolveWorkbenchLayout(
  preferences: LayoutPreferences,
  containerWidth: number,
): ResolvedWorkbenchLayout {
  const availableWidth = Math.max(containerWidth - ACTIVITY_BAR_WIDTH, 0);
  const editorMinWidth = Math.min(MIN_EDITOR_WIDTH, availableWidth);
  let remainingSidebarWidth = Math.max(availableWidth - editorMinWidth, 0);
  let primaryWidth = 0;
  let auxiliaryWidth = 0;
  const allocationOrder =
    preferences.priority === "auxiliary"
      ? (["auxiliary", "primary"] as const)
      : (["primary", "auxiliary"] as const);

  for (const side of allocationOrder) {
    const wantsVisible =
      side === "primary" ? preferences.primaryVisible : preferences.auxiliaryVisible;
    if (!wantsVisible) {
      continue;
    }

    const minWidth = side === "primary" ? MIN_PRIMARY_WIDTH : MIN_AUXILIARY_WIDTH;
    if (remainingSidebarWidth < minWidth) {
      continue;
    }

    const preferredWidth =
      side === "primary"
        ? Math.max(preferences.primaryWidth, MIN_PRIMARY_WIDTH)
        : Math.max(preferences.auxiliaryWidth, MIN_AUXILIARY_WIDTH);
    const width = Math.min(preferredWidth, remainingSidebarWidth);

    if (side === "primary") {
      primaryWidth = width;
    } else {
      auxiliaryWidth = width;
    }
    remainingSidebarWidth -= width;
  }

  return {
    primaryVisible: primaryWidth >= MIN_PRIMARY_WIDTH,
    primaryWidth,
    auxiliaryVisible: auxiliaryWidth >= MIN_AUXILIARY_WIDTH,
    auxiliaryWidth,
  };
}

function normalizeSidebarWidth(width: number, minWidth: number) {
  return Math.round(Math.max(width, minWidth));
}

function snapshotLayoutPreferences(
  preferences: LayoutPreferences,
  resolvedLayout: ResolvedWorkbenchLayout,
  hasAuxiliary: boolean,
): LayoutPreferences {
  return {
    ...preferences,
    primaryVisible: resolvedLayout.primaryVisible,
    primaryWidth: resolvedLayout.primaryVisible
      ? resolvedLayout.primaryWidth
      : preferences.primaryWidth,
    auxiliaryVisible: hasAuxiliary && resolvedLayout.auxiliaryVisible,
    auxiliaryWidth:
      hasAuxiliary && resolvedLayout.auxiliaryVisible
        ? resolvedLayout.auxiliaryWidth
        : preferences.auxiliaryWidth,
  };
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
  primarySidebar: Partial<Record<ActivityViewId, ReactNode>>;
  editor: ReactNode;
  auxiliary?: ReactNode;
  statusBar?: ReactNode;
};

export function WorkbenchLayout({
  primarySidebar,
  editor,
  auxiliary,
  statusBar,
}: WorkbenchLayoutProps) {
  const [activeView, setActiveView] = useState<ActivityViewId>("explorer");
  const [layoutPreferences, setLayoutPreferences] = useState<LayoutPreferences>({
    primaryVisible: true,
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
  const resolvedLayout = resolveWorkbenchLayout(layoutPreferences, containerWidth);
  const primarySidebarVisible = resolvedLayout.primaryVisible;
  const auxiliaryVisible = hasAuxiliary && resolvedLayout.auxiliaryVisible;

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
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  function handleSelectView(view: ActivityViewId) {
    if (view === activeView && primarySidebarVisible) {
      setLayoutPreferences((value) => ({
        ...value,
        primaryVisible: false,
      }));
      return;
    }
    setActiveView(view);
    setLayoutPreferences((value) => ({
      ...value,
      primaryVisible: true,
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

  const primaryContent = primarySidebar[activeView];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TitleBarPrimarySidebarToggle
        visible={primarySidebarVisible}
        onToggle={() =>
          setLayoutPreferences((value) => ({
            ...value,
            primaryVisible: !primarySidebarVisible,
            priority: "primary",
          }))
        }
      />
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
          activeView={activeView}
          primarySidebarVisible={primarySidebarVisible}
          onSelectView={handleSelectView}
        />
        {primarySidebarVisible ? (
          <PrimarySidebar activeView={activeView} width={resolvedLayout.primaryWidth}>
            {primaryContent}
          </PrimarySidebar>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{editor}</div>
        <AuxiliarySidebar visible={auxiliaryVisible} width={resolvedLayout.auxiliaryWidth}>
          {auxiliary}
        </AuxiliarySidebar>
        {primarySidebarVisible ? (
          <ResizeHandle
            active={activeResizeSide === "primary"}
            ariaLabel="调整主侧边栏宽度"
            position={ACTIVITY_BAR_WIDTH + resolvedLayout.primaryWidth}
            onPointerDown={(event) => startResizeDrag("primary", event)}
          />
        ) : null}
        {auxiliaryVisible ? (
          <ResizeHandle
            active={activeResizeSide === "auxiliary"}
            ariaLabel="调整辅助侧边栏宽度"
            position={containerWidth - resolvedLayout.auxiliaryWidth - 1}
            onPointerDown={(event) => startResizeDrag("auxiliary", event)}
          />
        ) : null}
      </div>
      {statusBar}
    </div>
  );
}
