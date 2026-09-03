export type ContextMenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ContextMenuInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type ContextMenuPlacementInput = {
  anchor: ContextMenuAnchor;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  insets: ContextMenuInsets;
  margin?: number;
  gap?: number;
};

type ContextMenuWidthInput = {
  anchor: ContextMenuAnchor;
  preferredMinimumWidth: number;
  viewportWidth: number;
  insets: Pick<ContextMenuInsets, "left" | "right">;
  margin?: number;
};

export type ContextMenuPlacement = {
  left: number;
  top: number;
  side: "above" | "below";
};

const DEFAULT_MARGIN = 8;
const DEFAULT_GAP = 4;

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum < minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveContextMenuWidth({
  anchor,
  preferredMinimumWidth,
  viewportWidth,
  insets,
  margin = DEFAULT_MARGIN,
}: ContextMenuWidthInput): { minWidth: number; maxWidth: number } {
  const availableWidth = Math.max(0, viewportWidth - insets.left - insets.right - margin * 2);

  return {
    minWidth: Math.min(availableWidth, Math.max(preferredMinimumWidth, anchor.width)),
    maxWidth: availableWidth,
  };
}

export function resolveContextMenuPlacement({
  anchor,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  insets,
  margin = DEFAULT_MARGIN,
  gap = DEFAULT_GAP,
}: ContextMenuPlacementInput): ContextMenuPlacement {
  const minimumLeft = insets.left + margin;
  const maximumLeft = viewportWidth - insets.right - margin - menuWidth;
  const minimumTop = insets.top + margin;
  const maximumTop = viewportHeight - insets.bottom - margin - menuHeight;
  const anchorBottom = anchor.y + anchor.height;
  const belowTop = anchorBottom + gap;
  const aboveTop = anchor.y - gap - menuHeight;
  const spaceBelow = viewportHeight - insets.bottom - margin - belowTop;
  const side = spaceBelow >= menuHeight ? "below" : "above";
  const preferredTop = side === "below" ? belowTop : aboveTop;

  return {
    left: clamp(anchor.x, minimumLeft, maximumLeft),
    top: clamp(preferredTop, minimumTop, maximumTop),
    side,
  };
}
