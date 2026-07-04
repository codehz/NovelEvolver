export type TreeDropPreview =
  | { kind: "highlight-root" }
  | { kind: "highlight-row"; rowId: string }
  | { kind: "insert-line"; index: number };

export type TreeResolvedDrop<TTarget> = {
  preview: TreeDropPreview;
  target: TTarget;
};

export type TreeRowHoverZone = "before" | "inside" | "after";
