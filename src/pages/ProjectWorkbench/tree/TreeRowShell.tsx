import { motion } from "motion/react";
import type { ReactNode, RefObject } from "react";

import { cn } from "#app/lib/cn";

import type { TreeResolvedDrop } from "./tree-drag";
import { treeRowPaddingVariants, treeRowVariants } from "./tree-row-motion";
import { TreeInlineInput } from "./TreeInlineInput";
import type { TreeDropResolveInput } from "./use-tree-row-pointer-drag";
import { useTreeRowPointerDrag } from "./use-tree-row-pointer-drag";

type TreeRowShellInput = {
  ariaLabel: string;
  initialValue: string;
  placeholder?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

type TreeRowShellProps<RowType extends string, DropTarget> = {
  rowId: string | null;
  rowIndex: number;
  rowType: RowType;
  depth: number;
  expanded: boolean;
  y: number;
  height: number;
  animateEnter: boolean;
  selected: boolean;
  dragging: boolean;
  iconClassName: string;
  label: string;
  trailingContent?: ReactNode;
  input: TreeRowShellInput | null;
  listRef?: RefObject<HTMLElement | null>;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
  onActivate: () => void;
  onDragStart: () => void;
  onDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  onDragEnd: () => void;
};

export function TreeRowShell<RowType extends string, DropTarget>({
  rowId,
  rowIndex,
  rowType,
  depth,
  expanded,
  y,
  height,
  animateEnter,
  selected,
  dragging,
  iconClassName,
  label,
  trailingContent,
  input,
  listRef,
  resolveDropTarget,
  onActivate,
  onDragStart,
  onDragMove,
  onDragEnd,
}: TreeRowShellProps<RowType, DropTarget>) {
  const isEditing = input !== null;
  const rowClasses = cn(
    "flex size-full items-center gap-1 overflow-hidden text-left text-app-foreground",
    !dragging && (selected || isEditing)
      ? "bg-app-background"
      : !dragging && "hover:bg-app-background/60",
  );
  const pointerHandlers = useTreeRowPointerDrag<RowType, DropTarget>({
    disabled: isEditing || rowId === null,
    dragSource: rowId === null ? null : { rowId, rowType },
    listRef,
    onActivate,
    onDragStart,
    onDragMove,
    onDragEnd,
    resolveDropTarget,
  });

  const rowContent = (
    <>
      <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-sm">
        {rowType === "folder" ? (
          <span
            className={cn(
              "icon-[codicon--chevron-right]",
              "motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded && "rotate-90",
            )}
          />
        ) : null}
      </span>
      <span aria-hidden="true" className={cn(iconClassName, "shrink-0 text-base")} />
      {input ? (
        <TreeInlineInput
          ariaLabel={input.ariaLabel}
          initialValue={input.initialValue}
          placeholder={input.placeholder}
          onCancel={input.onCancel}
          onConfirm={input.onConfirm}
        />
      ) : (
        <>
          <span className="truncate text-xs leading-5">{label}</span>
          {trailingContent}
        </>
      )}
    </>
  );

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
      {isEditing || rowId === null ? (
        <motion.div
          className={rowClasses}
          variants={treeRowPaddingVariants}
          custom={depth}
          initial={false}
          animate="visible"
        >
          {rowContent}
        </motion.div>
      ) : (
        <motion.button
          className={rowClasses}
          data-tree-row-id={rowId}
          data-tree-row-index={rowIndex}
          data-tree-row-type={rowType}
          type="button"
          variants={treeRowPaddingVariants}
          custom={depth}
          initial={false}
          animate="visible"
          {...pointerHandlers}
        >
          {rowContent}
        </motion.button>
      )}
    </motion.li>
  );
}
