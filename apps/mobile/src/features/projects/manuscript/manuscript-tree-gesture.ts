export type ManuscriptTreeDragAction = "rename" | "delete";

export type ManuscriptTreeDragZone =
  | { kind: "action"; action: ManuscriptTreeDragAction }
  | { kind: "inside" }
  | { kind: "outside" };

type ManuscriptTreeDragZoneInput = {
  x: number;
  y: number;
  rowTop: number;
  rowHeight: number;
  listWidth: number;
  actionWidth: number;
  actionGap: number;
  actionRightMargin: number;
};

export function resolveManuscriptTreeDragZone({
  x,
  y,
  rowTop,
  rowHeight,
  listWidth,
  actionWidth,
  actionGap,
  actionRightMargin,
}: ManuscriptTreeDragZoneInput): ManuscriptTreeDragZone {
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

export function manuscriptTreeDragZoneKey(zone: ManuscriptTreeDragZone | null): string {
  if (zone === null) return "";
  return zone.kind === "action" ? `${zone.kind}:${zone.action}` : zone.kind;
}
