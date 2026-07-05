import { motion } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "#app/lib/cn";

import { treeRowPaddingVariants, treeRowVariants } from "./tree-row-motion";

type TreeMotionRowProps = {
  y: number;
  height: number;
  animateEnter: boolean;
  depth: number;
  /** 覆盖 depth 缩进（例如搜索匹配行额外缩进）。 */
  paddingLeftPx?: number;
  className?: string;
  role?: "treeitem";
  "aria-expanded"?: boolean;
  tabIndex?: number;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  children: ReactNode;
};

export function TreeMotionRow({
  y,
  height,
  animateEnter,
  depth,
  paddingLeftPx,
  className,
  role = "treeitem",
  "aria-expanded": ariaExpanded,
  tabIndex,
  onClick,
  onKeyDown,
  children,
}: TreeMotionRowProps) {
  const useDepthPadding = paddingLeftPx === undefined;

  return (
    <motion.li
      className="absolute inset-x-0 z-10"
      role="none"
      style={{ top: 0, height }}
      variants={treeRowVariants}
      custom={y}
      initial={animateEnter ? "hidden" : false}
      animate="visible"
      exit="exit"
    >
      <motion.div
        role={role}
        aria-expanded={ariaExpanded}
        tabIndex={tabIndex}
        className={cn("flex size-full items-center gap-1 overflow-hidden pr-2", className)}
        variants={useDepthPadding ? treeRowPaddingVariants : undefined}
        custom={useDepthPadding ? depth : undefined}
        initial={false}
        animate={useDepthPadding ? "visible" : undefined}
        style={useDepthPadding ? undefined : { paddingLeft: paddingLeftPx }}
        onClick={onClick}
        onKeyDown={onKeyDown}
      >
        {children}
      </motion.div>
    </motion.li>
  );
}
