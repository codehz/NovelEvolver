export type ExplorerTreeDragAction = "rename" | "delete";

export type ExplorerTreeDragZone =
  | { kind: "action"; action: ExplorerTreeDragAction }
  | { kind: "inside" }
  | { kind: "outside" };

type ExplorerTreeDragZoneInput = {
  x: number;
  y: number;
  rowTop: number;
  rowHeight: number;
  listWidth: number;
  actionWidth: number;
  actionGap: number;
  actionRightMargin: number;
};

export function resolveExplorerTreeDragZone({
  x,
  y,
  rowTop,
  rowHeight,
  listWidth,
  actionWidth,
  actionGap,
  actionRightMargin,
}: ExplorerTreeDragZoneInput): ExplorerTreeDragZone {
  if (
    listWidth <= 0 ||
    actionWidth <= 0 ||
    actionGap < 0 ||
    actionRightMargin < 0 ||
    x < 0 ||
    x >= listWidth ||
    y < rowTop ||
    y >= rowTop + rowHeight
  ) {
    return { kind: "outside" };
  }

  const actionEnd = listWidth - actionRightMargin;
  const actionStart = Math.max(0, actionEnd - actionWidth * 2 - actionGap);
  const renameEnd = actionStart + actionWidth;
  const deleteStart = actionEnd - actionWidth;
  if (x < actionStart) return { kind: "inside" };
  if (x < renameEnd) return { kind: "action", action: "rename" };
  if (x < deleteStart) return { kind: "inside" };
  if (x < actionEnd) return { kind: "action", action: "delete" };
  return { kind: "inside" };
}

export function explorerTreeDragZoneKey(zone: ExplorerTreeDragZone | null): string {
  if (zone === null) return "";
  return zone.kind === "action" ? `${zone.kind}:${zone.action}` : zone.kind;
}

export function explorerTreeActionCenterX({
  action,
  listWidth,
  actionWidth,
  actionGap,
  actionRightMargin,
}: {
  action: ExplorerTreeDragAction;
  listWidth: number;
  actionWidth: number;
  actionGap: number;
  actionRightMargin: number;
}): number {
  const actionEnd = listWidth - actionRightMargin;
  if (action === "delete") return actionEnd - actionWidth / 2;
  return actionEnd - actionWidth * 1.5 - actionGap;
}

export function explorerTreeActionTooltipPlacement({
  rowTop,
  rowHeight,
  tooltipHeight,
  gap,
}: {
  rowTop: number;
  rowHeight: number;
  tooltipHeight: number;
  gap: number;
}): { top: number; side: "above" | "below" } {
  if (rowTop >= tooltipHeight + gap) {
    return { top: rowTop - gap - tooltipHeight, side: "above" };
  }
  return { top: rowTop + rowHeight + gap, side: "below" };
}
