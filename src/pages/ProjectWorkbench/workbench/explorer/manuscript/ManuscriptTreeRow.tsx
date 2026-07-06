import type { RefObject } from "react";

import type { FileChangeStatus, ManuscriptTreeNode } from "#shared/rpc/worktree-tree-rpc";

import { manuscriptTreeNodeIconClass } from "../../tree/content-tree-icons";
import { TreeChangeStatusBadge, treeChangeStatusLabelClass } from "../../tree/tree-change-status";
import type { TreeResolvedDrop } from "../../tree/tree-drag";
import type { TreeRowLayout } from "../../tree/tree-row-layout";
import { TreeRowShell } from "../../tree/TreeRowShell";
import type { TreeDropResolveInput } from "../../tree/use-tree-row-pointer-drag";
import type { ManuscriptEditingState, ManuscriptMoveTarget } from "./state/types";

type ManuscriptTreeRowProps = {
  id: string | null;
  title: string;
  type: ManuscriptTreeNode["type"];
  depth: number;
  expanded: boolean;
  index: number;
  layout: TreeRowLayout;
  selected: boolean;
  editing: ManuscriptEditingState | null;
  dragging: boolean;
  changeStatus?: FileChangeStatus;
  listRef: RefObject<HTMLUListElement | null>;
  resolveDropTarget: (
    input: TreeDropResolveInput<ManuscriptTreeNode["type"]>,
  ) => TreeResolvedDrop<ManuscriptMoveTarget> | null;
  onActivate: (
    id: string,
    type: ManuscriptTreeNode["type"],
    title: string,
    intent: "focus" | "open",
  ) => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: ManuscriptEditingState, title: string) => Promise<void>;
  onDragStart: (id: string, type: ManuscriptTreeNode["type"]) => void;
  onDragMove: (resolved: TreeResolvedDrop<ManuscriptMoveTarget> | null) => void;
  onDragEnd: () => void;
};

export function ManuscriptTreeRow({
  id,
  title,
  type,
  depth,
  expanded,
  index,
  layout,
  selected,
  editing,
  dragging,
  changeStatus,
  listRef,
  resolveDropTarget,
  onActivate,
  onCancelEditing,
  onSubmitEditing,
  onDragStart,
  onDragMove,
  onDragEnd,
}: ManuscriptTreeRowProps) {
  const inputAriaLabel =
    editing?.mode === "creating"
      ? type === "folder"
        ? "新文件夹名"
        : "新章节标题"
      : type === "folder"
        ? "重命名文件夹"
        : "重命名章节";
  return (
    <TreeRowShell<ManuscriptTreeNode["type"], ManuscriptMoveTarget>
      layout={layout}
      depth={depth}
      disclosureExpanded={type === "folder" ? expanded : undefined}
      selected={selected}
      dragging={dragging}
      iconClassName={manuscriptTreeNodeIconClass(type, expanded)}
      label={title}
      labelClassName={treeChangeStatusLabelClass(changeStatus, type)}
      trailingContent={
        changeStatus ? <TreeChangeStatusBadge status={changeStatus} rowType={type} /> : null
      }
      input={
        editing
          ? {
              ariaLabel: inputAriaLabel,
              initialValue: editing.mode === "renaming" ? title : "",
              onCancel: onCancelEditing,
              onConfirm: (nextTitle) => {
                void onSubmitEditing(editing, nextTitle);
              },
            }
          : null
      }
      interaction={
        id === null
          ? null
          : {
              rowId: id,
              rowIndex: index,
              rowType: type,
              listRef,
              resolveDropTarget,
              onActivate: () => {
                onActivate(id, type, title, "focus");
              },
              onDoubleActivate:
                type === "folder"
                  ? () => {}
                  : () => {
                      onActivate(id, type, title, "open");
                    },
              onDragStart: () => {
                onDragStart(id, type);
              },
              onDragMove,
              onDragEnd,
            }
      }
    />
  );
}
