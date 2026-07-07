import type { ReactNode, RefObject } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { DisclosureChevron } from "#app/shared/ui/DisclosureChevron";

import type { TreeResolvedDrop } from "./tree-drag";
import type { TreeRowLayout } from "./tree-row-layout";
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

type TreeRowShellInteraction<RowType extends string, DropTarget> = {
  rowId: string;
  rowIndex: number;
  rowType: RowType;
  listRef?: RefObject<HTMLElement | null>;
  resolveDropTarget: (input: TreeDropResolveInput<RowType>) => TreeResolvedDrop<DropTarget> | null;
  onActivate: () => void;
  onDoubleActivate?: () => void;
  onDragStart: () => void;
  onDragMove: (resolved: TreeResolvedDrop<DropTarget> | null) => void;
  onDragEnd: () => void;
};

type TreeRowShellProps<RowType extends string, DropTarget> = {
  layout: TreeRowLayout;
  depth: number;
  disclosureExpanded?: boolean;
  selected: boolean;
  dragging: boolean;
  iconClassName: string;
  label: string;
  labelClassName?: string;
  trailingContent?: ReactNode;
  input: TreeRowShellInput | null;
  interaction?: TreeRowShellInteraction<RowType, DropTarget> | null;
};

export function TreeRowShell<RowType extends string, DropTarget>({
  layout,
  depth,
  disclosureExpanded,
  selected,
  dragging,
  iconClassName,
  label,
  labelClassName,
  trailingContent,
  input,
  interaction = null,
}: TreeRowShellProps<RowType, DropTarget>) {
  const isEditing = input !== null;
  const isInteractive = !isEditing && interaction !== null;
  const rowClasses = cn(
    "pr-4 text-left text-app-foreground",
    !dragging && (selected || isEditing)
      ? "bg-app-background"
      : !dragging && "hover:bg-app-background/60",
  );
  const pointerHandlers = useTreeRowPointerDrag<RowType, DropTarget>({
    disabled: !isInteractive,
    dragSource:
      interaction === null ? null : { rowId: interaction.rowId, rowType: interaction.rowType },
    listRef: interaction?.listRef,
    onActivate: interaction?.onActivate ?? (() => {}),
    onDoubleActivate: interaction?.onDoubleActivate ?? interaction?.onActivate ?? (() => {}),
    onDragStart: interaction?.onDragStart ?? (() => {}),
    onDragMove: interaction?.onDragMove ?? (() => {}),
    onDragEnd: interaction?.onDragEnd ?? (() => {}),
    resolveDropTarget: interaction?.resolveDropTarget ?? (() => null),
  });

  const rowContent = (
    <>
      {disclosureExpanded !== undefined ? (
        <DisclosureChevron expanded={disclosureExpanded} />
      ) : (
        <span aria-hidden="true" className={treeRowDisclosureSpacerClass} />
      )}
      <span aria-hidden="true" className={iconClassName} />
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

  return !isInteractive ? (
    <TreeMotionRow
      layout={layout}
      depth={depth}
      className={rowClasses}
      aria-expanded={disclosureExpanded}
    >
      {rowContent}
    </TreeMotionRow>
  ) : (
    <TreeMotionRow
      as="button"
      layout={layout}
      depth={depth}
      className={rowClasses}
      aria-expanded={disclosureExpanded}
      data-tree-row-id={interaction.rowId}
      data-tree-row-index={interaction.rowIndex}
      data-tree-row-type={interaction.rowType}
      onDoubleClick={interaction.onDoubleActivate}
      {...pointerHandlers}
    >
      {rowContent}
    </TreeMotionRow>
  );
}
