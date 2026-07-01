import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useRef } from "react";

import { cn } from "#app/lib/cn";

import { resolveDropTargetFromRow } from "./drag-hit-test";
import { ResourceTreeInlineInput } from "./ResourceTreeInlineInput";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import type { ResourceTreeDragState } from "./state/types";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

/** 拖动识别阈值（px）：位移超过此值才从"按下"进入"拖动中"。 */
const DRAG_THRESHOLD = 4;

function TreeRow({
  item,
  selectedPath,
  drag,
  onActivate,
  onCancelEditing,
  onSubmitEditing,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  item: FlatRenderItem;
  selectedPath: string | null;
  drag: ResourceTreeDragState | null;
  onActivate: (path: string, type: "file" | "folder") => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: NonNullable<FlatRenderItem["editing"]>, name: string) => Promise<void>;
  onDragStart: (sourcePath: string, sourceType: "file" | "folder") => void;
  onDragMove: (targetPath: string | null) => void;
  onDragEnd: () => void;
}) {
  const isFolder = item.type === "folder";
  const icon = isFolder
    ? item.expanded
      ? cn("icon-[codicon--folder-opened]")
      : cn("icon-[codicon--folder]")
    : cn("icon-[codicon--file]");
  const isSelected = item.path !== null && selectedPath === item.path;
  const isEditing = item.editing !== null;

  // 拖放高亮：目标文件夹自身及其所有后代行一起高亮（子树连续，无割裂感）。
  // 根目录目标（""）由 <ul> 背景统一渲染，行本身不单独高亮，避免顶层行重复着色。
  const isInDropSubtree =
    drag !== null &&
    drag.targetPath !== null &&
    drag.targetPath !== "" &&
    item.path !== null &&
    (item.path === drag.targetPath || item.path.startsWith(`${drag.targetPath}/`));

  const rowClasses = cn(
    "flex min-h-6 w-full items-center gap-1 text-left text-app-foreground",
    isInDropSubtree
      ? "bg-resource-drop-target"
      : drag === null && (isSelected || isEditing)
        ? "bg-workbench-tab-active"
        : drag === null && "hover:bg-workbench-tab-active/60",
  );

  // pointer 手势本地状态：按下但尚未进入拖动时记录起点。
  const pointerStartRef = useRef<{
    id: number;
    x: number;
    y: number;
    path: string;
    type: "file" | "folder";
  } | null>(null);
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (item.editing !== null || item.path === null) {
        return;
      }
      pointerStartRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        path: item.path,
        type: item.type,
      };
      draggingRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [item.editing, item.path, item.type],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointerStartRef.current;
      if (start === null || start.id !== event.pointerId) {
        return;
      }
      if (!draggingRef.current) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) {
          return;
        }
        draggingRef.current = true;
        onDragStart(start.path, start.type);
      }
      // setPointerCapture 使 pointermove 始终派发给源行，无法用事件接收者判断目标。
      // 用 elementFromPoint 找指针视觉所在行，读取其 data-row-path / data-row-type。
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-row-path]");
      if (target === null || target === undefined) {
        // 指针不在任何行上 → 视为根目录放置区。
        onDragMove("");
        return;
      }
      const targetPath = target.dataset.rowPath;
      const targetType = target.dataset.rowType;
      if (targetPath === undefined || targetType === undefined) {
        onDragMove("");
        return;
      }
      onDragMove(
        resolveDropTargetFromRow(
          targetPath,
          targetType === "folder" ? "folder" : "file",
          start.path,
          start.type,
        ),
      );
    },
    [onDragMove, onDragStart],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (start === null || start.id !== event.pointerId) {
        return;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (draggingRef.current) {
        draggingRef.current = false;
        onDragEnd();
        return;
      }
      // 未进入拖动 → 视为普通点击。
      if (item.path !== null) {
        onActivate(item.path, item.type);
      }
    },
    [item, onActivate, onDragEnd],
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      draggingRef.current = false;
      if (start !== null && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDragMove(null);
    },
    [onDragMove],
  );

  const rowContent = (
    <>
      <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-sm">
        {isFolder &&
          (item.expanded ? (
            <span className={cn("icon-[codicon--chevron-down]")} />
          ) : (
            <span className={cn("icon-[codicon--chevron-right]")} />
          ))}
      </span>
      <span aria-hidden="true" className={cn(icon, "shrink-0 text-base")} />
      {item.editing ? (
        <ResourceTreeInlineInput
          initialValue={item.editing.mode === "renaming" ? item.name : ""}
          kind={item.editing.kind}
          mode={item.editing.mode}
          onCancel={onCancelEditing}
          onConfirm={(name) => {
            void onSubmitEditing(item.editing!, name);
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
    <li role="none">
      {item.editing ? (
        <div className={rowClasses} style={{ paddingLeft: `${item.depth * 12 + 4}px` }}>
          {rowContent}
        </div>
      ) : (
        <button
          className={rowClasses}
          data-row-path={item.path ?? undefined}
          data-row-type={item.type}
          style={{ paddingLeft: `${item.depth * 12 + 4}px` }}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {rowContent}
        </button>
      )}
    </li>
  );
}

function ResourceLibraryTreeContent({
  renderItems,
  selectedPath,
  drag,
}: {
  renderItems: FlatRenderItem[];
  selectedPath: string | null;
  drag: ResourceTreeDragState | null;
}) {
  const { activateNode, startRenaming, cancelEditing, submitEditing, deleteNode, moveNode } =
    useResourceLibraryTreeActions();
  const { treeUiAtom } = useMolecule(resourceLibraryTreeMolecule);
  const dispatchUi = useSetAtom(treeUiAtom);
  const store = useStore();

  const handleDragStart = useCallback(
    (sourcePath: string, sourceType: "file" | "folder") => {
      dispatchUi({ type: "dragStart", sourcePath, sourceType });
    },
    [dispatchUi],
  );

  const handleDragMove = useCallback(
    (targetPath: string | null) => {
      dispatchUi({ type: "dragMove", targetPath });
    },
    [dispatchUi],
  );

  const handleDragEnd = useCallback(() => {
    // 从 store 读取最新 drag，避免闭包捕获渲染快照导致的陈旧值。
    const currentDrag = store.get(treeUiAtom).drag;
    dispatchUi({ type: "dragEnd" });
    if (
      currentDrag === null ||
      currentDrag.targetPath === null ||
      currentDrag.targetPath === currentDrag.sourcePath
    ) {
      return;
    }
    void moveNode(currentDrag.sourcePath, currentDrag.sourceType, currentDrag.targetPath);
  }, [dispatchUi, moveNode, store, treeUiAtom]);

  const isRootDropTarget = drag !== null && drag.targetPath === "";

  return (
    <ul
      className={cn("flex flex-col outline-none", isRootDropTarget && "bg-resource-drop-target")}
      role="tree"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          event.preventDefault();
          startRenaming();
        } else if (event.key === "Delete") {
          event.preventDefault();
          void deleteNode();
        } else if (event.key === "Escape" && drag !== null) {
          event.preventDefault();
          dispatchUi({ type: "dragEnd" });
        }
      }}
    >
      {renderItems.map((item) => (
        <TreeRow
          key={item.key}
          item={item}
          selectedPath={selectedPath}
          drag={drag}
          onActivate={activateNode}
          onCancelEditing={cancelEditing}
          onSubmitEditing={submitEditing}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        />
      ))}
    </ul>
  );
}

export function ResourceLibraryTree() {
  const { treeDataAtom, flatRenderItemsAtom, selectedPathAtom, treeUiAtom } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const data = useAtomValue(treeDataAtom);
  const renderItems = useAtomValue(flatRenderItemsAtom);
  const selectedPath = useAtomValue(selectedPathAtom);
  const ui = useAtomValue(treeUiAtom);

  if (data.status === "loading" || data.status === "idle") {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">加载资源库…</p>;
  }

  if (data.status === "error") {
    return (
      <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
        {data.error}
      </p>
    );
  }

  if (renderItems.length === 0) {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">资源库为空。</p>;
  }

  return (
    <ResourceLibraryTreeContent
      renderItems={renderItems}
      selectedPath={selectedPath}
      drag={ui.drag}
    />
  );
}
