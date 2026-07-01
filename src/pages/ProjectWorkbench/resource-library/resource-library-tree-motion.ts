import type { Transition } from "motion/react";

export const RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX = 24;
export const RESOURCE_LIBRARY_TREE_Y_DURATION_MS = 220;

export const resourceLibraryTreeRowYTransition: Transition = {
  duration: RESOURCE_LIBRARY_TREE_Y_DURATION_MS / 1000,
  ease: [0.22, 1, 0.36, 1],
};
