export type ExplorerHoverZone = "before" | "inside" | "after";

export type ExplorerMoveTarget =
  | { kind: "into"; parentId: string }
  | { kind: "insert"; parentId: string; index: number };

export type ExplorerDropPreview =
  | { kind: "insert"; visualIndex: number; depth: number }
  | { kind: "highlight"; startIndex: number; endIndex: number };

export type ExplorerResolvedDrop = {
  preview: ExplorerDropPreview;
  target: ExplorerMoveTarget;
  commit: boolean;
};

export function resolveHoverZone(offsetY: number, rowHeight: number): ExplorerHoverZone {
  if (offsetY < rowHeight * 0.25) return "before";
  if (offsetY > rowHeight * 0.75) return "after";
  return "inside";
}

export function dropKey(drop: ExplorerResolvedDrop | null): string {
  if (drop === null) return "";
  const prefix = drop.commit ? "move" : "restore";
  if (drop.target.kind === "into") return `${prefix}:into:${drop.target.parentId}`;
  return `${prefix}:insert:${drop.target.parentId}:${drop.target.index}`;
}
