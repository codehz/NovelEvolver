import { motion } from "motion/react";
import { useCallback } from "react";

import { cn } from "#app/lib/cn";
import type { ManuscriptNode } from "#shared/rpc/projects-rpc";

import { findTreeRowDataAtPoint } from "../tree/tree-row-dom";
import { treeRowPaddingVariants, treeRowVariants } from "../tree/tree-row-motion";
import { TreeInlineInput } from "../tree/TreeInlineInput";
import { useTreeRowPointerDrag } from "../tree/use-tree-row-pointer-drag";
import type { ManuscriptEditingState, ManuscriptDragState } from "./state/types";

type ManuscriptTreeRowProps = {
  id: string | null;
  title: string;
  type: ManuscriptNode["type"];
  depth: number;
  expanded: boolean;
  y: number;
  height: number;
  animateEnter: boolean;
  selected: boolean;
  editing: ManuscriptEditingState | null;
  drag: ManuscriptDragState | null;
  onActivate: (id: string, type: ManuscriptNode["type"], title: string) => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: ManuscriptEditingState, title: string) => Promise<void>;
  onDragStart: (id: string, type: ManuscriptNode["type"]) => void;
  onDragMove: (targetParentId: string | null) => void;
  onDragEnd: () => void;
};

function rowIcon(type: ManuscriptNode["type"], expanded: boolean) {
  if (type === "folder") {
    return expanded ? cn("icon-[codicon--folder-opened]") : cn("icon-[codicon--folder]");
  }
  return cn("icon-[codicon--book]");
}

function isDropHighlighted(id: string | null, drag: ManuscriptDragState | null): boolean {
  return id !== null && drag !== null && drag.targetParentId === id;
}

export function ManuscriptTreeRow({
  id,
  title,
  type,
  depth,
  expanded,
  y,
  height,
  animateEnter,
  selected,
  editing,
  drag,
  onActivate,
  onCancelEditing,
  onSubmitEditing,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ManuscriptTreeRowProps) {
  const isEditing = editing !== null;
  const inputAriaLabel =
    editing?.mode === "creating"
      ? type === "folder"
        ? "新文件夹名"
        : "新章节标题"
      : type === "folder"
        ? "重命名文件夹"
        : "重命名章节";
  const rowClasses = cn(
    "flex size-full items-center gap-1 overflow-hidden text-left text-app-foreground",
    isDropHighlighted(id, drag)
      ? "bg-resource-drop-target"
      : drag === null && (selected || isEditing)
        ? "bg-workbench-tab-active"
        : drag === null && "hover:bg-workbench-tab-active/60",
  );
  const resolveDropTarget = useCallback(
    (
      _start: { rowId: string; rowType: ManuscriptNode["type"] },
      clientX: number,
      clientY: number,
    ) => {
      const target = findTreeRowDataAtPoint<ManuscriptNode["type"]>(clientX, clientY);
      if (target === null) {
        return "root";
      }
      return target.rowType === "folder" ? target.rowId : null;
    },
    [],
  );
  const pointerHandlers = useTreeRowPointerDrag({
    disabled: isEditing || id === null,
    dragSource: id === null ? null : { rowId: id, rowType: type },
    onActivate: () => {
      if (id !== null) {
        onActivate(id, type, title);
      }
    },
    onDragStart: () => {
      if (id !== null) {
        onDragStart(id, type);
      }
    },
    onDragMove,
    onDragEnd,
    resolveDropTarget,
  });

  const rowContent = (
    <>
      <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-sm">
        {type === "folder" ? (
          <span
            className={cn(
              "icon-[codicon--chevron-right]",
              "motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded && "rotate-90",
            )}
          />
        ) : null}
      </span>
      <span aria-hidden="true" className={cn(rowIcon(type, expanded), "shrink-0 text-base")} />
      {editing ? (
        <TreeInlineInput
          ariaLabel={inputAriaLabel}
          initialValue={editing.mode === "renaming" ? title : ""}
          onCancel={onCancelEditing}
          onConfirm={(nextTitle) => {
            void onSubmitEditing(editing, nextTitle);
          }}
        />
      ) : (
        <span className="truncate text-xs leading-5">{title}</span>
      )}
    </>
  );

  return (
    <motion.li
      className="absolute inset-x-0"
      role="none"
      style={{ top: 0, height }}
      variants={treeRowVariants}
      custom={y}
      initial={animateEnter ? "hidden" : false}
      animate="visible"
      exit="exit"
    >
      {isEditing || id === null ? (
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
          data-tree-row-id={id}
          data-tree-row-type={type}
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
