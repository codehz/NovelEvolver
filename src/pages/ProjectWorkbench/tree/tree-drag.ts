export type TreeDropPreview =
  | { kind: "highlight"; top: number; height: number }
  | { kind: "insert"; top: number; height: number };

export type TreeResolvedDrop<TTarget> = {
  preview: TreeDropPreview;
  target: TTarget;
};

export type TreeRowHoverZone = "before" | "inside" | "after";
