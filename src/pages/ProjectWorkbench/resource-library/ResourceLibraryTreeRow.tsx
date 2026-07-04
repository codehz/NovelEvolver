import { motion } from "motion/react";

import { cn } from "#app/lib/cn";

import type { TreeResolvedDrop, TreeRowHoverZone } from "../tree/tree-drag";
import type { TreeRowDomData } from "../tree/tree-row-dom";
import { treeRowPaddingVariants, treeRowVariants } from "../tree/tree-row-motion";
import { TreeInlineInput } from "../tree/TreeInlineInput";
import { useTreeRowPointerDrag } from "../tree/use-tree-row-pointer-drag";
import type { FlatRenderItem } from "./state/tree-data-reducer";

type ResourceLibraryTreeRowProps = {
  item: FlatRenderItem;
  index: number;
  y: number;
  height: number;
  animateEnter: boolean;
  selectedPath: string | null;
  dragging: boolean;
  resolveDropTarget: (input: {
    start: { rowId: string; rowType: "file" | "folder" };
    hoveredRow: TreeRowDomData<"file" | "folder"> | null;
    hoverZone: TreeRowHoverZone | null;
    listRect: DOMRect | null;
    clientX: number;
    clientY: number;
  }) => TreeResolvedDrop<string> | null;
  onActivate: (path: string, type: "file" | "folder") => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: NonNullable<FlatRenderItem["editing"]>, name: string) => Promise<void>;
  onDragStart: (sourcePath: string, sourceType: "file" | "folder") => void;
  onDragMove: (resolved: TreeResolvedDrop<string> | null) => void;
  onDragEnd: () => void;
};

function getRowIcon(item: FlatRenderItem) {
  if (item.type === "folder") {
    return item.expanded ? cn("icon-[codicon--folder-opened]") : cn("icon-[codicon--folder]");
  }
  return cn("icon-[codicon--file]");
}

export function ResourceLibraryTreeRow({
  item,
  index,
  y,
  height,
  animateEnter,
  selectedPath,
  dragging,
  resolveDropTarget,
  onActivate,
  onCancelEditing,
  onSubmitEditing,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ResourceLibraryTreeRowProps) {
  const isSelected = item.path !== null && selectedPath === item.path;
  const editing = item.editing;
  const isEditing = editing !== null;
  const inputAriaLabel =
    editing?.mode === "creating"
      ? editing.kind === "file"
        ? "新文件名"
        : "新文件夹名"
      : editing?.kind === "file"
        ? "重命名文件"
        : "重命名文件夹";
  const inputPlaceholder =
    editing?.mode === "creating"
      ? editing.kind === "file"
        ? "例如 设定/世界观.md"
        : "例如 设定/资料"
      : undefined;
  const rowClasses = cn(
    "flex size-full items-center gap-1 overflow-hidden text-left text-app-foreground",
    !dragging && (isSelected || isEditing)
      ? "bg-workbench-tab-active"
      : !dragging && "hover:bg-workbench-tab-active/60",
  );
  const pointerHandlers = useTreeRowPointerDrag({
    disabled: isEditing,
    dragSource: item.path === null ? null : { rowId: item.path, rowType: item.type },
    onActivate: () => {
      if (item.path !== null) {
        onActivate(item.path, item.type);
      }
    },
    onDragStart: () => {
      if (item.path !== null) {
        onDragStart(item.path, item.type);
      }
    },
    onDragMove,
    onDragEnd,
    resolveDropTarget,
  });

  const rowContent = (
    <>
      <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-sm">
        {item.type === "folder" && (
          <span
            className={cn(
              "icon-[codicon--chevron-right]",
              "motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
              item.expanded && "rotate-90",
            )}
          />
        )}
      </span>
      <span aria-hidden="true" className={cn(getRowIcon(item), "shrink-0 text-base")} />
      {editing ? (
        <TreeInlineInput
          ariaLabel={inputAriaLabel}
          initialValue={editing.mode === "renaming" ? item.name : ""}
          placeholder={inputPlaceholder}
          onCancel={onCancelEditing}
          onConfirm={(name) => {
            void onSubmitEditing(editing, name);
          }}
        />
      ) : (
        <>
          <span className="truncate text-xs leading-5">{item.name}</span>
          {item.loading ? <span className="ml-auto text-xs text-ctp-overlay0">…</span> : null}
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
      {isEditing ? (
        <motion.div
          className={rowClasses}
          variants={treeRowPaddingVariants}
          custom={item.depth}
          initial={false}
          animate="visible"
        >
          {rowContent}
        </motion.div>
      ) : (
        <motion.button
          className={rowClasses}
          data-tree-row-id={item.path ?? undefined}
          data-tree-row-index={item.path === null ? undefined : index}
          data-tree-row-type={item.type}
          type="button"
          variants={treeRowPaddingVariants}
          custom={item.depth}
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
