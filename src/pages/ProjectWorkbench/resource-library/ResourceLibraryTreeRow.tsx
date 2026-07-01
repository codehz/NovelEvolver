import type { CSSProperties } from "react";

import { cn } from "#app/lib/cn";

import {
  RESOURCE_LIBRARY_TREE_EASING,
  RESOURCE_LIBRARY_TREE_ENTER_DURATION_MS,
  RESOURCE_LIBRARY_TREE_EXIT_DURATION_MS,
  RESOURCE_LIBRARY_TREE_MOVE_DURATION_MS,
  type ResourceLibraryTreeRowPhase,
} from "./resource-library-tree-motion";
import { ResourceTreeInlineInput } from "./ResourceTreeInlineInput";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import type { ResourceTreeDragState } from "./state/types";
import { useTreeRowPointerDrag } from "./use-tree-row-pointer-drag";

type ResourceLibraryTreeRowProps = {
  item: FlatRenderItem;
  phase: ResourceLibraryTreeRowPhase;
  top: number;
  height: number;
  selectedPath: string | null;
  drag: ResourceTreeDragState | null;
  onActivate: (path: string, type: "file" | "folder") => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: NonNullable<FlatRenderItem["editing"]>, name: string) => Promise<void>;
  onDragStart: (sourcePath: string, sourceType: "file" | "folder") => void;
  onDragMove: (targetPath: string | null) => void;
  onDragEnd: () => void;
};

function isDropHighlighted(item: FlatRenderItem, drag: ResourceTreeDragState | null) {
  return (
    drag !== null &&
    drag.targetPath !== null &&
    drag.targetPath !== "" &&
    item.path !== null &&
    (item.path === drag.targetPath || item.path.startsWith(`${drag.targetPath}/`))
  );
}

function getRowIcon(item: FlatRenderItem) {
  if (item.type === "folder") {
    return item.expanded ? cn("icon-[codicon--folder-opened]") : cn("icon-[codicon--folder]");
  }
  return cn("icon-[codicon--file]");
}

export function ResourceLibraryTreeRow({
  item,
  phase,
  top,
  height,
  selectedPath,
  drag,
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
  const isExiting = phase === "exiting";
  const rowClasses = cn(
    "flex size-full items-center gap-1 overflow-hidden text-left text-app-foreground",
    "motion-safe:transition-[padding-left] motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
    isDropHighlighted(item, drag)
      ? "bg-resource-drop-target"
      : drag === null && (isSelected || isEditing)
        ? "bg-workbench-tab-active"
        : drag === null && "hover:bg-workbench-tab-active/60",
  );
  const rowStyle = { paddingLeft: `${item.depth * 12 + 4}px` };
  const wrapperStyle: CSSProperties = {
    top,
    height,
    transitionDuration: `${phase === "exiting" ? RESOURCE_LIBRARY_TREE_EXIT_DURATION_MS : phase === "enter-from" ? RESOURCE_LIBRARY_TREE_ENTER_DURATION_MS : RESOURCE_LIBRARY_TREE_MOVE_DURATION_MS}ms`,
    transitionTimingFunction: RESOURCE_LIBRARY_TREE_EASING,
  };
  const pointerHandlers = useTreeRowPointerDrag({
    disabled: isEditing || isExiting,
    sourcePath: item.path,
    sourceType: item.type,
    onActivate,
    onDragStart,
    onDragMove,
    onDragEnd,
  });

  const rowContent = (
    <>
      <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-sm">
        {item.type === "folder" &&
          (item.expanded ? (
            <span className={cn("icon-[codicon--chevron-down]")} />
          ) : (
            <span className={cn("icon-[codicon--chevron-right]")} />
          ))}
      </span>
      <span aria-hidden="true" className={cn(getRowIcon(item), "shrink-0 text-base")} />
      {editing ? (
        <ResourceTreeInlineInput
          initialValue={editing.mode === "renaming" ? item.name : ""}
          kind={editing.kind}
          mode={editing.mode}
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
    <li
      aria-hidden={isExiting || undefined}
      className={cn(
        "absolute inset-x-0 motion-safe:transition-[top,opacity,transform]",
        phase === "enter-from" && "-translate-y-1.5 opacity-0",
        phase === "exiting" && "z-10 -translate-y-1 opacity-0",
      )}
      role="none"
      style={wrapperStyle}
    >
      {isEditing || isExiting ? (
        <div className={rowClasses} style={rowStyle}>
          {rowContent}
        </div>
      ) : (
        <button
          className={rowClasses}
          data-row-path={item.path ?? undefined}
          data-row-type={item.type}
          style={rowStyle}
          type="button"
          {...pointerHandlers}
        >
          {rowContent}
        </button>
      )}
    </li>
  );
}
