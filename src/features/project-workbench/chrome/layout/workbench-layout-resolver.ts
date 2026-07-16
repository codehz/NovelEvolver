export const ACTIVITY_BAR_WIDTH = 48;
export const DEFAULT_PRIMARY_WIDTH = 256;
export const DEFAULT_AUXILIARY_WIDTH = 320;
export const MIN_PRIMARY_WIDTH = 208;
export const MIN_AUXILIARY_WIDTH = 240;
export const CLOSE_SIDEBAR_THRESHOLD = 160;
export const MIN_EDITOR_WIDTH = 520;
/**
 * Horizontal chrome unit for modern UI:
 * - sash between sidebar and editor (owned by the dock chrome layer)
 * - auxiliary right edge inset from the window
 */
export const WORKBENCH_SIDEBAR_INSET = 8;

/**
 * In-flow dock spacer width when visible.
 * Sash lives inside the dock chrome layer (opacity-animated with the panel), so it
 * is reserved here rather than as a separate flex sibling.
 * - primary: panel + sash
 * - auxiliary: sash + panel + right window edge inset
 */
export function sidebarChromeOuterSize(panelWidth: number, side: "primary" | "auxiliary") {
  return side === "primary"
    ? panelWidth + WORKBENCH_SIDEBAR_INSET
    : panelWidth + WORKBENCH_SIDEBAR_INSET * 2;
}

/** Extra width reserved beyond panel when a sidebar is visible (sash [+ right edge]). */
export function sidebarChromeExtraWidth(side: "primary" | "auxiliary") {
  return side === "primary" ? WORKBENCH_SIDEBAR_INSET : WORKBENCH_SIDEBAR_INSET * 2;
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
  side: "primary" | "auxiliary";
  enabled: boolean;
  resolvedVisible: boolean;
  resolvedWidth: number;
  preferredWidth: number;
  minWidth: number;
};

function resolveSidebarChrome({
  side,
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
    spacerWidth: visible ? sidebarChromeOuterSize(panelWidth, side) : 0,
  };
}

export function resolveWorkbenchLayout(
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
    // primary: sash only; auxiliary: sash + right window edge
    const chromeExtra = sidebarChromeExtraWidth(side);
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
      side: "primary",
      enabled: true,
      resolvedVisible: resolved.primaryVisible,
      resolvedWidth: resolved.primaryWidth,
      preferredWidth: layoutPreferences.primaryWidth,
      minWidth: MIN_PRIMARY_WIDTH,
    }),
    auxiliary: resolveSidebarChrome({
      side: "auxiliary",
      enabled: true,
      resolvedVisible: resolved.auxiliaryVisible,
      resolvedWidth: resolved.auxiliaryWidth,
      preferredWidth: layoutPreferences.auxiliaryWidth,
      minWidth: MIN_AUXILIARY_WIDTH,
    }),
  };
}
