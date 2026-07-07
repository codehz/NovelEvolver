import { motion } from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import type { TreeRowLayout } from "./tree-row-layout";
import { treeRowPaddingVariants, treeRowVariants } from "./tree-row-motion";

type TreeMotionRowBaseProps = {
  layout: TreeRowLayout;
  depth: number;
  /** 覆盖 depth 缩进（例如搜索匹配行额外缩进）。 */
  paddingLeftPx?: number;
  className?: string;
  role?: HTMLMotionProps<"div">["role"];
  children: ReactNode;
};

type TreeMotionRowDivProps = TreeMotionRowBaseProps &
  Omit<HTMLMotionProps<"div">, keyof TreeMotionRowBaseProps> & {
    as?: "div";
  };

type TreeMotionRowButtonProps = TreeMotionRowBaseProps &
  Omit<HTMLMotionProps<"button">, keyof TreeMotionRowBaseProps> & {
    as: "button";
  };

type TreeMotionRowProps = TreeMotionRowDivProps | TreeMotionRowButtonProps;

export function TreeMotionRow(props: TreeMotionRowProps) {
  const {
    as = "div",
    layout,
    depth,
    paddingLeftPx,
    className,
    role = "treeitem",
    children,
    ...domProps
  } = props;
  const { y, height, animateEnter } = layout;
  const useDepthPadding = paddingLeftPx === undefined;
  const rowClassName = cn("flex size-full items-center gap-1 overflow-hidden pr-2", className);
  const sharedMotionProps = {
    role,
    className: rowClassName,
    variants: useDepthPadding ? treeRowPaddingVariants : undefined,
    custom: useDepthPadding ? depth : undefined,
    initial: false,
    animate: useDepthPadding ? "visible" : undefined,
    style: useDepthPadding ? undefined : { paddingLeft: paddingLeftPx },
  } as const;

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
      {as === "button" ? (
        <motion.button
          type={
            (domProps as Omit<TreeMotionRowButtonProps, keyof TreeMotionRowBaseProps | "as">)
              .type ?? "button"
          }
          {...sharedMotionProps}
          {...(domProps as Omit<TreeMotionRowButtonProps, keyof TreeMotionRowBaseProps | "as">)}
        >
          {children}
        </motion.button>
      ) : (
        <motion.div
          {...sharedMotionProps}
          {...(domProps as Omit<TreeMotionRowDivProps, keyof TreeMotionRowBaseProps | "as">)}
        >
          {children}
        </motion.div>
      )}
    </motion.li>
  );
}
