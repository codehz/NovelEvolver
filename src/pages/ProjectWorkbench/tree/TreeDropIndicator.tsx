import { motion } from "motion/react";

import { cn } from "#app/lib/cn";

import type { TreeDropPreview } from "./tree-drag";
import {
  treeRowEnterOpacityTransition,
  treeRowExitOpacityTransition,
  treeRowYTransition,
} from "./tree-row-motion";

type TreeDropIndicatorProps = {
  preview: TreeDropPreview;
};

export function TreeDropIndicator({ preview }: TreeDropIndicatorProps) {
  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 transition-colors",
        preview.kind === "highlight" ? "bg-tree-drop-target z-0" : "bg-tree-drop-indicator z-20",
      )}
      style={{ top: 0 }}
      initial={{
        opacity: 0,
        y: preview.top,
        height: preview.height,
      }}
      animate={{
        opacity: 1,
        y: preview.top,
        height: preview.height,
        transition: {
          opacity: treeRowEnterOpacityTransition,
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
