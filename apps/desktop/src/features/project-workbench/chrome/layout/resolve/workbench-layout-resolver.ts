export const ACTIVITY_BAR_WIDTH = 48;
export const DEFAULT_PRIMARY_WIDTH = 256;
export const DEFAULT_AUXILIARY_WIDTH = 320;
export const MIN_PRIMARY_WIDTH = 208;
export const MIN_AUXILIARY_WIDTH = 240;
export const CLOSE_SIDEBAR_THRESHOLD = 160;
export const MIN_EDITOR_WIDTH = 520;
/**
 * Horizontal chrome unit for modern UI:
 * sash between sidebar and editor (owned by the dock chrome layer).
 */
export const WORKBENCH_SIDEBAR_INSET = 8;
/**
 * Always-present right window-edge gap at the workbench row level.
 * Kept outside SidebarDock so the editor still breathes when auxiliary is hidden.
 */
export const WORKBENCH_EDGE_INSET = WORKBENCH_SIDEBAR_INSET;

/**
 * In-flow dock spacer width when visible.
 * Sash lives inside the dock chrome layer (opacity-animated with the panel), so it
 * is reserved here rather than as a separate flex sibling.
 * Both sides: panel + sash. Right window edge is reserved by WorkbenchLayout, not the dock.
 */
export function sidebarChromeOuterSize(panelWidth: number) {
  return panelWidth + WORKBENCH_SIDEBAR_INSET;
}

/** Extra width reserved beyond panel when a sidebar is visible (sash only). */
export function sidebarChromeExtraWidth() {
  return WORKBENCH_SIDEBAR_INSET;
}

export type ResizePriority = "primary" | "auxiliary";

export type LayoutPreferences = {
  primaryVisible: boolean;
  primaryWidth: number;
  auxiliaryVisible: boolean;
  auxiliaryWidth: number;
  priority: ResizePriority;
};

export type ResolvedWorkbenchLayout = {
  primaryVisible: boolean;
  primaryWidth: number;
  auxiliaryVisible: boolean;
  auxiliaryWidth: number;
};

export type SidebarChromeMetrics = {
  visible: boolean;
  panelWidth: number;
  spacerWidth: number;
};

export type WorkbenchChromeLayout = {
  resolved: ResolvedWorkbenchLayout;
  primary: SidebarChromeMetrics;
  auxiliary: SidebarChromeMetrics;
};

type SidebarSpec = {
  enabled: boolean;
  resolvedVisible: boolean;
  resolvedWidth: number;
  preferredWidth: number;
  minWidth: number;
};

function resolveSidebarChrome({
  enabled,
  resolvedVisible,
  resolvedWidth,
  preferredWidth,
  minWidth,
}: SidebarSpec): SidebarChromeMetrics {
  const visible = enabled && resolvedVisible;
  const widthSource = visible ? resolvedWidth : preferredWidth;
  const panelWidth = normalizeSidebarWidth(widthSource, minWidth);
  return {
    visible,
    panelWidth,
    spacerWidth: visible ? sidebarChromeOuterSize(panelWidth) : 0,
  };
}

export function resolveWorkbenchLayout(
  preferences: LayoutPreferences,
  containerWidth: number,
): ResolvedWorkbenchLayout {
  // Activity bar (left) + right window-edge gap are always reserved.
  const availableWidth = Math.max(containerWidth - ACTIVITY_BAR_WIDTH - WORKBENCH_EDGE_INSET, 0);
  const editorMinWidth = Math.min(MIN_EDITOR_WIDTH, availableWidth);
  let remainingSidebarWidth = Math.max(availableWidth - editorMinWidth, 0);
  let primaryWidth = 0;
  let auxiliaryWidth = 0;
  const allocationOrder =
    preferences.priority === "auxiliary"
      ? (["auxiliary", "primary"] as const)
      : (["primary", "auxiliary"] as const);
  const chromeExtra = sidebarChromeExtraWidth();

  for (const side of allocationOrder) {
    const wantsVisible =
      side === "primary" ? preferences.primaryVisible : preferences.auxiliaryVisible;
    if (!wantsVisible) {
      continue;
    }

    const minWidth = side === "primary" ? MIN_PRIMARY_WIDTH : MIN_AUXILIARY_WIDTH;
    if (remainingSidebarWidth < minWidth + chromeExtra) {
      continue;
    }

    const preferredWidth =
      side === "primary"
        ? Math.max(preferences.primaryWidth, MIN_PRIMARY_WIDTH)
        : Math.max(preferences.auxiliaryWidth, MIN_AUXILIARY_WIDTH);
    const width = Math.min(preferredWidth, remainingSidebarWidth - chromeExtra);

    if (side === "primary") {
      primaryWidth = width;
    } else {
      auxiliaryWidth = width;
    }
    remainingSidebarWidth -= width + chromeExtra;
  }

  return {
    primaryVisible: primaryWidth >= MIN_PRIMARY_WIDTH,
    primaryWidth,
    auxiliaryVisible: auxiliaryWidth >= MIN_AUXILIARY_WIDTH,
    auxiliaryWidth,
  };
}

export function normalizeSidebarWidth(width: number, minWidth: number) {
  return Math.round(Math.max(width, minWidth));
}

export function snapshotLayoutPreferences(
  preferences: LayoutPreferences,
  resolvedLayout: ResolvedWorkbenchLayout,
): LayoutPreferences {
  return {
    ...preferences,
    primaryVisible: resolvedLayout.primaryVisible,
    primaryWidth: resolvedLayout.primaryVisible
      ? resolvedLayout.primaryWidth
      : preferences.primaryWidth,
    auxiliaryVisible: resolvedLayout.auxiliaryVisible,
    auxiliaryWidth: resolvedLayout.auxiliaryVisible
      ? resolvedLayout.auxiliaryWidth
      : preferences.auxiliaryWidth,
  };
}

export function deriveWorkbenchChromeLayout(input: {
  layoutPreferences: LayoutPreferences;
  containerWidth: number;
}): WorkbenchChromeLayout {
  const { layoutPreferences, containerWidth } = input;
  const resolved = resolveWorkbenchLayout(layoutPreferences, containerWidth);

  return {
    resolved,
    primary: resolveSidebarChrome({
      enabled: true,
      resolvedVisible: resolved.primaryVisible,
      resolvedWidth: resolved.primaryWidth,
      preferredWidth: layoutPreferences.primaryWidth,
      minWidth: MIN_PRIMARY_WIDTH,
    }),
    auxiliary: resolveSidebarChrome({
      enabled: true,
      resolvedVisible: resolved.auxiliaryVisible,
      resolvedWidth: resolved.auxiliaryWidth,
      preferredWidth: layoutPreferences.auxiliaryWidth,
      minWidth: MIN_AUXILIARY_WIDTH,
    }),
  };
}
