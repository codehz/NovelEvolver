export type TreeDropPreview =
  | { kind: "highlight"; top: number; height: number }
  | { kind: "insert"; top: number; height: number; depth: number };

export type TreeResolvedDrop<TTarget> = {
  preview: TreeDropPreview;
  target: TTarget;
};

export type TreeRowHoverZone = "before" | "inside" | "after";

/** Resolve before / inside / after from pointer Y within a row rect. */
export function resolveHoverZone(clientY: number, rect: DOMRect): TreeRowHoverZone {
  const offsetY = clientY - rect.top;
  if (offsetY < rect.height * 0.25) {
    return "before";
  }
  if (offsetY > rect.height * 0.75) {
    return "after";
  }
  return "inside";
}
