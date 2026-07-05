import type { RefObject } from "react";

import { cn } from "#app/lib/cn";
import type { ManuscriptTreeNode } from "#shared/rpc/worktree-tree";

import type { TreeResolvedDrop } from "../tree/tree-drag";
import { TreeRowShell } from "../tree/TreeRowShell";
import type { TreeDropResolveInput } from "../tree/use-tree-row-pointer-drag";
import type { ManuscriptEditingState, ManuscriptMoveTarget } from "./state/types";

type ManuscriptTreeRowProps = {
  id: string | null;
  title: string;
  type: ManuscriptTreeNode["type"];
  depth: number;
  expanded: boolean;
  index: number;
  y: number;
  height: number;
  animateEnter: boolean;
  selected: boolean;
  editing: ManuscriptEditingState | null;
  dragging: boolean;
  listRef: RefObject<HTMLUListElement | null>;
  resolveDropTarget: (
    input: TreeDropResolveInput<ManuscriptTreeNode["type"]>,
  ) => TreeResolvedDrop<ManuscriptMoveTarget> | null;
  onActivate: (id: string, type: ManuscriptTreeNode["type"], title: string) => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: ManuscriptEditingState, title: string) => Promise<void>;
  onDragStart: (id: string, type: ManuscriptTreeNode["type"]) => void;
  onDragMove: (resolved: TreeResolvedDrop<ManuscriptMoveTarget> | null) => void;
  onDragEnd: () => void;
};

function rowIcon(type: ManuscriptTreeNode["type"], expanded: boolean) {
  if (type === "folder") {
    return expanded ? cn("icon-[codicon--folder-opened]") : cn("icon-[codicon--folder]");
  }
  return cn("icon-[codicon--book]");
}

export function ManuscriptTreeRow({
  id,
  title,
  type,
  depth,
  expanded,
  index,
  y,
  height,
  animateEnter,
  selected,
  editing,
  dragging,
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
      rowId={id}
      rowIndex={index}
      rowType={type}
      depth={depth}
      expanded={expanded}
      y={y}
      height={height}
      animateEnter={animateEnter}
      selected={selected}
      dragging={dragging}
      iconClassName={rowIcon(type, expanded)}
      label={title}
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
      listRef={listRef}
      resolveDropTarget={resolveDropTarget}
      onActivate={() => {
        if (id !== null) {
          onActivate(id, type, title);
        }
      }}
      onDragStart={() => {
        if (id !== null) {
          onDragStart(id, type);
        }
      }}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    />
  );
}
