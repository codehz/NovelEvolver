import type { RefObject } from "react";

import { cn } from "#app/lib/cn";
import type { ResourceTreeNode } from "#shared/rpc/worktree-tree-rpc";

import { TreeChangeStatusBadge, treeChangeStatusLabelClass } from "../../tree/tree-change-status";
import type { TreeResolvedDrop } from "../../tree/tree-drag";
import type { TreeRowLayout } from "../../tree/tree-row-layout";
import { TreeRowShell } from "../../tree/TreeRowShell";
import type { TreeDropResolveInput } from "../../tree/use-tree-row-pointer-drag";
import type { ResourceRenderItem } from "./resource-tree-projector";

type ResourceLibraryTreeRowProps = {
  item: ResourceRenderItem;
  index: number;
  layout: TreeRowLayout;
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
  layout,
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
  const rowId = item.id;
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
      layout={layout}
      depth={item.depth}
      disclosureExpanded={item.type === "folder" ? item.expanded : undefined}
      selected={isSelected}
      dragging={dragging}
      iconClassName={getRowIcon(item)}
      label={item.name}
      labelClassName={treeChangeStatusLabelClass(item.changeStatus, item.type)}
      trailingContent={
        <>
          {item.loading ? <span className="ml-auto text-xs text-ctp-overlay0">…</span> : null}
          {item.changeStatus && !item.loading ? (
            <TreeChangeStatusBadge status={item.changeStatus} rowType={item.type} />
          ) : null}
        </>
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
      interaction={
        rowId === null
          ? null
          : {
              rowId,
              rowIndex: index,
              rowType: item.type,
              listRef,
              resolveDropTarget,
              onActivate: () => {
                onActivate(rowId, item.type, item.name);
              },
              onDragStart: () => {
                onDragStart(rowId, item.type);
              },
              onDragMove,
              onDragEnd,
            }
      }
    />
  );
}
