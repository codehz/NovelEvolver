import type { Transition, Variants } from "motion/react";

import { cn } from "#app/lib/cn";

export const TREE_ROW_HEIGHT_PX = 24;
export const TREE_DROP_INDICATOR_HEIGHT_PX = 4;
export const TREE_ROW_Y_DURATION_MS = 220;
export const TREE_ROW_ENTER_Y_OFFSET_PX = 6;
export const TREE_ROW_DEPTH_INDENT_PX = 6;
export const TREE_ROW_BASE_PADDING_LEFT_PX = 8;
export const TREE_ROW_DISCLOSURE_WIDTH_PX = 16;
export const TREE_ROW_CONTENT_GAP_PX = 4;

export const treeRowDisclosureSpacerClass = cn("size-4 shrink-0");

const treeEase = [0.22, 1, 0.36, 1] as const;

export const treeRowYTransition: Transition = {
  duration: TREE_ROW_Y_DURATION_MS / 1000,
  ease: treeEase,
};

export const treeRowEnterOpacityTransition: Transition = {
  duration: TREE_ROW_Y_DURATION_MS / 1000,
  ease: treeEase,
};

export const treeRowPaddingLeftTransition: Transition = {
  duration: TREE_ROW_Y_DURATION_MS / 1000,
  ease: treeEase,
};

export function getTreeRowPaddingLeft(depth: number): number {
  return depth * TREE_ROW_DEPTH_INDENT_PX + TREE_ROW_BASE_PADDING_LEFT_PX;
}

/**
 * 条状插入指示器从图标槽位起始处开始，而不是整行全宽，
 * 以表达目标插入层级。
 */
export function getTreeRowInsertIndicatorLeft(depth: number): number {
  return getTreeRowPaddingLeft(depth) + TREE_ROW_DISCLOSURE_WIDTH_PX + TREE_ROW_CONTENT_GAP_PX;
}

/** 退出仅淡出；禁止在 exit 中设置 y（绝对定位 + 列表高度不同步会导致错位）。 */
export const treeRowExitOpacityTransition: Transition = {
  duration: TREE_ROW_Y_DURATION_MS / 1000,
  ease: treeEase,
};

/**
 * 树行动画契约（冻结）：
 * - 定位：top 固定 0，纵向槽位仅通过 y（translateY）表达。
 * - 进入（hidden → visible）：y 从目标槽位上移 ENTER_Y_OFFSET + opacity 0→1。
 * - 重排 / 拖移后：仅 y 补间到新区间。
 * - 退出（exit）：仅 opacity 1→0，不做 y / height 动画。
 */
export const treeRowVariants: Variants = {
  hidden: (y: number) => ({
    y: y - TREE_ROW_ENTER_Y_OFFSET_PX,
    opacity: 0,
  }),
  visible: (y: number) => ({
    y,
    opacity: 1,
    transition: {
      y: treeRowYTransition,
      opacity: treeRowEnterOpacityTransition,
    },
  }),
  exit: {
    opacity: 0,
    transition: {
      opacity: treeRowExitOpacityTransition,
    },
  },
};

export const treeRowPaddingVariants: Variants = {
  visible: (depth: number) => ({
    paddingLeft: getTreeRowPaddingLeft(depth),
    transition: {
      paddingLeft: treeRowPaddingLeftTransition,
    },
  }),
};
