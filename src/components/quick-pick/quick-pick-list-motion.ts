import type { MotionProps } from "motion/react";

const listSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.85,
};

export const quickPickListRowMotion: MotionProps = {
  layout: true,
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: listSpring,
};

export const quickPickListDividerMotion: MotionProps = {
  layout: true,
  initial: { opacity: 0, scaleX: 0.92 },
  animate: { opacity: 1, scaleX: 1 },
  exit: { opacity: 0, scaleX: 0.92 },
  transition: { ...listSpring, mass: 0.7 },
};

export const quickPickListEmptyMotion: MotionProps = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

/** 列表键盘/鼠标高亮层，在选项之间通过 layoutId 共享布局动画。 */
export const QUICK_PICK_HIGHLIGHT_LAYOUT_ID = "quick-pick-list-highlight";

export const quickPickHighlightSurfaceTransition = listSpring;
