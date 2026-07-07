export const ACTIVITY_BAR_WIDTH = 48;
export const DEFAULT_PRIMARY_WIDTH = 256;
export const DEFAULT_AUXILIARY_WIDTH = 320;
export const MIN_PRIMARY_WIDTH = 208;
export const MIN_AUXILIARY_WIDTH = 240;
export const CLOSE_SIDEBAR_THRESHOLD = 160;
export const MIN_EDITOR_WIDTH = 520;

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
    spacerWidth: visible ? panelWidth : 0,
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

export function normalizeSidebarWidth(width: number, minWidth: number) {
  return Math.round(Math.max(width, minWidth));
}

export function snapshotLayoutPreferences(
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

export function deriveWorkbenchChromeLayout(input: {
  layoutPreferences: LayoutPreferences;
  containerWidth: number;
  canShowPrimary: boolean;
  hasAuxiliary: boolean;
}): WorkbenchChromeLayout {
  const { layoutPreferences, containerWidth, canShowPrimary, hasAuxiliary } = input;
  const resolved = resolveWorkbenchLayout(
    {
      ...layoutPreferences,
      primaryVisible: canShowPrimary && layoutPreferences.primaryVisible,
    },
    containerWidth,
  );

  return {
    resolved,
    primary: resolveSidebarChrome({
      enabled: canShowPrimary,
      resolvedVisible: resolved.primaryVisible,
      resolvedWidth: resolved.primaryWidth,
      preferredWidth: layoutPreferences.primaryWidth,
      minWidth: MIN_PRIMARY_WIDTH,
    }),
    auxiliary: resolveSidebarChrome({
      enabled: hasAuxiliary,
      resolvedVisible: resolved.auxiliaryVisible,
      resolvedWidth: resolved.auxiliaryWidth,
      preferredWidth: layoutPreferences.auxiliaryWidth,
      minWidth: MIN_AUXILIARY_WIDTH,
    }),
  };
}
