import type { RefObject } from "react";

import type { ResourceTreeNode } from "#shared/rpc/worktree-tree-rpc";

import { resourceTreeNodeIconClass } from "../../tree/content-tree-icons";
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
  onActivate: (
    id: string,
    type: ResourceTreeNode["type"],
    name: string,
    intent: "focus" | "open",
  ) => void;
  onCancelEditing: () => void;
  onSubmitEditing: (
    editing: NonNullable<ResourceRenderItem["editing"]>,
    name: string,
  ) => Promise<void>;
  onDragStart: (sourceId: string, sourceType: ResourceTreeNode["type"]) => void;
  onDragMove: (resolved: TreeResolvedDrop<string> | null) => void;
  onDragEnd: () => void;
  onContextMenu?: (
    id: string,
    type: ResourceTreeNode["type"],
    position: { x: number; y: number },
  ) => void;
};

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
  onContextMenu,
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
      iconClassName={resourceTreeNodeIconClass(item.type, item.expanded)}
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
                onActivate(rowId, item.type, item.name, "focus");
              },
              onDoubleActivate:
                item.type === "folder"
                  ? () => {}
                  : () => {
                      onActivate(rowId, item.type, item.name, "open");
                    },
              onDragStart: () => {
                onDragStart(rowId, item.type);
              },
              onDragMove,
              onDragEnd,
              onContextMenu:
                onContextMenu === undefined
                  ? undefined
                  : (position) => {
                      onContextMenu(rowId, item.type, position);
                    },
            }
      }
    />
  );
}
