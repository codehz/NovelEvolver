import type { RefObject } from "react";

import { cn } from "#app/lib/cn";

import type { TreeResolvedDrop } from "../tree/tree-drag";
import { TreeRowShell } from "../tree/TreeRowShell";
import type { TreeDropResolveInput } from "../tree/use-tree-row-pointer-drag";
import type { ResourceRenderItem } from "./resource-tree-projector";

type ResourceLibraryTreeRowProps = {
  item: ResourceRenderItem;
  index: number;
  y: number;
  height: number;
  animateEnter: boolean;
  selectedPath: string | null;
  dragging: boolean;
  listRef: RefObject<HTMLUListElement | null>;
  resolveDropTarget: (
    input: TreeDropResolveInput<"file" | "folder">,
  ) => TreeResolvedDrop<string> | null;
  onActivate: (path: string, type: "file" | "folder") => void;
  onCancelEditing: () => void;
  onSubmitEditing: (
    editing: NonNullable<ResourceRenderItem["editing"]>,
    name: string,
  ) => Promise<void>;
  onDragStart: (sourcePath: string, sourceType: "file" | "folder") => void;
  onDragMove: (resolved: TreeResolvedDrop<string> | null) => void;
  onDragEnd: () => void;
};

function getRowIcon(item: ResourceRenderItem) {
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
  listRef,
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
  return (
    <TreeRowShell<"file" | "folder", string>
      rowId={item.path}
      rowIndex={index}
      rowType={item.type}
      depth={item.depth}
      expanded={item.expanded}
      y={y}
      height={height}
      animateEnter={animateEnter}
      selected={isSelected}
      dragging={dragging}
      iconClassName={getRowIcon(item)}
      label={item.name}
      trailingContent={
        item.loading ? <span className="ml-auto text-xs text-ctp-overlay0">…</span> : null
      }
      input={
        editing
          ? {
              ariaLabel: inputAriaLabel,
              initialValue: editing.mode === "renaming" ? item.name : "",
              placeholder: inputPlaceholder,
              onCancel: onCancelEditing,
              onConfirm: (name) => {
                void onSubmitEditing(editing, name);
              },
            }
          : null
      }
      listRef={listRef}
      resolveDropTarget={resolveDropTarget}
      onActivate={() => {
        if (item.path !== null) {
          onActivate(item.path, item.type);
        }
      }}
      onDragStart={() => {
        if (item.path !== null) {
          onDragStart(item.path, item.type);
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  );
}
