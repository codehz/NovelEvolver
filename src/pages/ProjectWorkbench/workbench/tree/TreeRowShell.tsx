import type { ReactNode, RefObject } from "react";

import { DisclosureChevron } from "#app/components/DisclosureChevron";
import { cn } from "#app/lib/cn";

import type { TreeResolvedDrop } from "./tree-drag";
import { treeRowDisclosureSpacerClass } from "./tree-row-motion";
import { TreeInlineInput } from "./TreeInlineInput";
import { TreeMotionRow } from "./TreeMotionRow";
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
  showDisclosure: boolean;
  expanded: boolean;
  y: number;
  height: number;
  animateEnter: boolean;
  selected: boolean;
  dragging: boolean;
  iconClassName: string;
  label: string;
  labelClassName?: string;
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
  showDisclosure,
  expanded,
  y,
  height,
  animateEnter,
  selected,
  dragging,
  iconClassName,
  label,
  labelClassName,
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
    "flex size-full items-center gap-1 overflow-hidden pr-4 text-left text-app-foreground",
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
      {showDisclosure ? (
        <DisclosureChevron expanded={expanded} />
      ) : (
        <span aria-hidden="true" className={treeRowDisclosureSpacerClass} />
      )}
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
          <span className={cn("truncate text-xs leading-5", labelClassName)}>{label}</span>
          {trailingContent}
        </>
      )}
    </>
  );

  return isEditing || rowId === null ? (
    <TreeMotionRow
      y={y}
      height={height}
      animateEnter={animateEnter}
      depth={depth}
      className={rowClasses}
      aria-expanded={showDisclosure ? expanded : undefined}
    >
      {rowContent}
    </TreeMotionRow>
  ) : (
    <TreeMotionRow
      as="button"
      y={y}
      height={height}
      animateEnter={animateEnter}
      depth={depth}
      className={rowClasses}
      aria-expanded={showDisclosure ? expanded : undefined}
      data-tree-row-id={rowId}
      data-tree-row-index={rowIndex}
      data-tree-row-type={rowType}
      {...pointerHandlers}
    >
      {rowContent}
    </TreeMotionRow>
  );
}
