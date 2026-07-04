import { motion } from "motion/react";

import { cn } from "#app/lib/cn";
import type { ManuscriptNode } from "#shared/rpc/projects-rpc";

import {
  resourceLibraryTreeRowPaddingVariants,
  resourceLibraryTreeRowVariants,
} from "../resource-library/resource-library-tree-motion";
import { ResourceTreeInlineInput } from "../resource-library/ResourceTreeInlineInput";
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
  const rowClasses = cn(
    "flex size-full items-center gap-1 overflow-hidden text-left text-app-foreground",
    isDropHighlighted(id, drag)
      ? "bg-resource-drop-target"
      : drag === null && (selected || isEditing)
        ? "bg-workbench-tab-active"
        : drag === null && "hover:bg-workbench-tab-active/60",
  );

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
        <ResourceTreeInlineInput
          initialValue={editing.mode === "renaming" ? title : ""}
          kind={type === "folder" ? "folder" : "file"}
          mode={editing.mode}
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
      variants={resourceLibraryTreeRowVariants}
      custom={y}
      initial={animateEnter ? "hidden" : false}
      animate="visible"
      exit="exit"
    >
      {isEditing || id === null ? (
        <motion.div
          className={rowClasses}
          variants={resourceLibraryTreeRowPaddingVariants}
          custom={depth}
          initial={false}
          animate="visible"
        >
          {rowContent}
        </motion.div>
      ) : (
        <motion.button
          className={rowClasses}
          data-manuscript-node-id={id}
          data-manuscript-node-type={type}
          type="button"
          variants={resourceLibraryTreeRowPaddingVariants}
          custom={depth}
          initial={false}
          animate="visible"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.dragStartX = String(event.clientX);
            event.currentTarget.dataset.dragStartY = String(event.clientY);
          }}
          onPointerMove={(event) => {
            const startX = Number(event.currentTarget.dataset.dragStartX);
            const startY = Number(event.currentTarget.dataset.dragStartY);
            if (!Number.isFinite(startX) || !Number.isFinite(startY)) {
              return;
            }
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (drag === null && dx * dx + dy * dy >= 16) {
              onDragStart(id, type);
            }
            const target = document
              .elementFromPoint(event.clientX, event.clientY)
              ?.closest<HTMLElement>("[data-manuscript-node-id]");
            if (!target) {
              onDragMove("root");
              return;
            }
            const targetId = target.dataset.manuscriptNodeId;
            const targetType = target.dataset.manuscriptNodeType;
            if (!targetId || !targetType) {
              onDragMove(null);
              return;
            }
            onDragMove(targetType === "folder" ? targetId : null);
          }}
          onPointerUp={(event) => {
            const wasDragging = drag !== null;
            delete event.currentTarget.dataset.dragStartX;
            delete event.currentTarget.dataset.dragStartY;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            if (wasDragging) {
              onDragEnd();
              return;
            }
            onActivate(id, type, title);
          }}
          onPointerCancel={(event) => {
            delete event.currentTarget.dataset.dragStartX;
            delete event.currentTarget.dataset.dragStartY;
            onDragMove(null);
          }}
        >
          {rowContent}
        </motion.button>
      )}
    </motion.li>
  );
}
