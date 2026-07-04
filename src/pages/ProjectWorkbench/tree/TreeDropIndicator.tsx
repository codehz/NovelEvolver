import { motion } from "motion/react";

import { cn } from "#app/lib/cn";

import type { TreeDropPreview } from "./tree-drag";
import { getTreeRowInsertIndicatorLeft, treeRowPaddingLeftTransition } from "./tree-row-motion";
import {
  treeRowEnterOpacityTransition,
  treeRowExitOpacityTransition,
  treeRowYTransition,
} from "./tree-row-motion";

type TreeDropIndicatorProps = {
  preview: TreeDropPreview;
};

export function TreeDropIndicator({ preview }: TreeDropIndicatorProps) {
  const left = preview.kind === "insert" ? getTreeRowInsertIndicatorLeft(preview.depth) : 0;

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute right-0 transition-colors",
        preview.kind === "highlight" ? "z-0 bg-tree-drop-target" : "z-20 bg-tree-drop-indicator",
      )}
      style={{ top: 0 }}
      initial={{
        opacity: 0,
        left,
        y: preview.top,
        height: preview.height,
      }}
      animate={{
        opacity: 1,
        left,
        y: preview.top,
        height: preview.height,
        transition: {
          opacity: treeRowEnterOpacityTransition,
          left: treeRowPaddingLeftTransition,
          y: treeRowYTransition,
          height: treeRowYTransition,
        },
      }}
      exit={{
        opacity: 0,
        transition: {
          opacity: treeRowExitOpacityTransition,
        },
      }}
    />
  );
}
