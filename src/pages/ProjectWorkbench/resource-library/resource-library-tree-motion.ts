import type { Transition } from "motion/react";

export const RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX = 24;
export const RESOURCE_LIBRARY_TREE_Y_DURATION_MS = 220;
export const RESOURCE_LIBRARY_TREE_ENTER_Y_OFFSET_PX = 6;

const treeEase = [0.22, 1, 0.36, 1] as const;

export const resourceLibraryTreeRowYTransition: Transition = {
  duration: RESOURCE_LIBRARY_TREE_Y_DURATION_MS / 1000,
  ease: treeEase,
};

export const resourceLibraryTreeRowEnterOpacityTransition: Transition = {
  duration: RESOURCE_LIBRARY_TREE_Y_DURATION_MS / 1000,
  ease: treeEase,
};
