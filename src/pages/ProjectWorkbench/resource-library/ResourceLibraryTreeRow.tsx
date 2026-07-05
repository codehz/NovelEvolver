import type { RefObject } from "react";

import { cn } from "#app/lib/cn";
import type { ResourceTreeNode } from "#shared/rpc/worktree-tree";

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
  selectedId: string | null;
  dragging: boolean;
  listRef: RefObject<HTMLUListElement | null>;
  resolveDropTarget: (
    input: TreeDropResolveInput<ResourceTreeNode["type"]>,
  ) => TreeResolvedDrop<string> | null;
  onActivate: (id: string, type: ResourceTreeNode["type"], name: string) => void;
  onCancelEditing: () => void;
  onSubmitEditing: (
    editing: NonNullable<ResourceRenderItem["editing"]>,
    name: string,
  ) => Promise<void>;
  onDragStart: (sourceId: string, sourceType: ResourceTreeNode["type"]) => void;
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
  selectedId,
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
  const isSelected = item.id !== null && selectedId === item.id;
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
        ? "例如 world.md"
        : "例如 设定"
      : undefined;
  return (
    <TreeRowShell<ResourceTreeNode["type"], string>
      rowId={item.id}
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
        if (item.id !== null) {
          onActivate(item.id, item.type, item.name);
        }
      }}
      onDragStart={() => {
        if (item.id !== null) {
          onDragStart(item.id, item.type);
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  );
}
