import { effects, preset } from "@codehz/auto-transition";

const listEase = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Quick Pick 列表行 enter/exit/move，由 `AutoTransition` 应用在 `<ul>` 子节点上。 */
export const quickPickListTransition = preset({
  enter: [effects.fade(0), effects.translate({ x: 0, y: -6 })],
  exit: [effects.fade(0), effects.translate({ x: 0, y: -4 })],
  move: effects.flip(),
  timing: {
    enter: { duration: 280, easing: listEase },
    exit: { duration: 220, easing: "ease-in" },
    move: { duration: 280, easing: listEase },
  },
});

/** 列表键盘/鼠标高亮层，在选项之间通过 layoutId 共享布局动画。 */
export const QUICK_PICK_HIGHLIGHT_LAYOUT_ID = "quick-pick-list-highlight";

export const quickPickHighlightSurfaceTransition = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};
