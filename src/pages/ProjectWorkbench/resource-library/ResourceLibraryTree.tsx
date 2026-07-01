import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "#app/lib/cn";

import {
  RESOURCE_LIBRARY_TREE_EASING,
  RESOURCE_LIBRARY_TREE_EXIT_DURATION_MS,
  RESOURCE_LIBRARY_TREE_MOVE_DURATION_MS,
  RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX,
  type ResourceLibraryTreeRowPhase,
} from "./resource-library-tree-motion";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import type { ResourceTreeDragState } from "./state/types";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

type AnimatedTreeItem = {
  key: string;
  item: FlatRenderItem;
  top: number;
  phase: ResourceLibraryTreeRowPhase;
};

function createAnimatedTreeItems(
  renderItems: FlatRenderItem[],
  animateEnter: boolean,
  previousItems: AnimatedTreeItem[] = [],
): AnimatedTreeItem[] {
  const previousByKey = new Map(previousItems.map((item) => [item.key, item]));
  const nextKeys = new Set(renderItems.map((item) => item.key));

  const presentItems = renderItems.map((item, index) => {
    const previous = previousByKey.get(item.key);
    return {
      key: item.key,
      item,
      top: index * RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX,
      phase: previous
        ? previous.phase === "exiting"
          ? "present"
          : previous.phase
        : animateEnter
          ? "enter-from"
          : "present",
    } satisfies AnimatedTreeItem;
  });

  const exitingItems = previousItems
    .filter((item) => !nextKeys.has(item.key))
    .map((item) => ({
      ...item,
      phase: "exiting" as const,
    }));

  return [...presentItems, ...exitingItems];
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
  const [animatedItems, setAnimatedItems] = useState(() =>
    createAnimatedTreeItems(renderItems, false),
  );
  const hasAnimatedLayoutRef = useRef(false);
  const exitTimeoutsRef = useRef(new Map<string, number>());

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
  const listHeight = useMemo(() => {
    const visibleHeight = renderItems.length * RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX;
    const animatedHeight = animatedItems.reduce(
      (maxHeight, item) => Math.max(maxHeight, item.top + RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX),
      0,
    );
    return Math.max(visibleHeight, animatedHeight);
  }, [animatedItems, renderItems.length]);

  useLayoutEffect(() => {
    setAnimatedItems((previousItems) =>
      createAnimatedTreeItems(renderItems, hasAnimatedLayoutRef.current, previousItems),
    );
    hasAnimatedLayoutRef.current = true;
  }, [renderItems]);

  useEffect(() => {
    const enteringKeys = animatedItems
      .filter((item) => item.phase === "enter-from")
      .map((item) => item.key);
    if (enteringKeys.length === 0) {
      return;
    }
    const enteringKeySet = new Set(enteringKeys);
    const animationFrameId = requestAnimationFrame(() => {
      setAnimatedItems((previousItems) =>
        previousItems.map((item) =>
          enteringKeySet.has(item.key) && item.phase === "enter-from"
            ? { ...item, phase: "present" }
            : item,
        ),
      );
    });
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [animatedItems]);

  useEffect(() => {
    const exitingKeys = new Set(
      animatedItems.filter((item) => item.phase === "exiting").map((item) => item.key),
    );

    for (const key of exitingKeys) {
      if (exitTimeoutsRef.current.has(key)) {
        continue;
      }
      const timeoutId = window.setTimeout(() => {
        exitTimeoutsRef.current.delete(key);
        setAnimatedItems((previousItems) => previousItems.filter((item) => item.key !== key));
      }, RESOURCE_LIBRARY_TREE_EXIT_DURATION_MS);
      exitTimeoutsRef.current.set(key, timeoutId);
    }

    for (const [key, timeoutId] of exitTimeoutsRef.current) {
      if (exitingKeys.has(key)) {
        continue;
      }
      window.clearTimeout(timeoutId);
      exitTimeoutsRef.current.delete(key);
    }
  }, [animatedItems]);

  useEffect(
    () => () => {
      for (const timeoutId of exitTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      exitTimeoutsRef.current.clear();
    },
    [],
  );

  if (renderItems.length === 0 && animatedItems.length === 0) {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">资源库为空。</p>;
  }

  return (
    <ul
      className={cn("outline-none", isRootDropTarget && "bg-resource-drop-target")}
      role="tree"
      style={{
        height: listHeight,
        position: "relative",
        transitionDuration: `${RESOURCE_LIBRARY_TREE_MOVE_DURATION_MS}ms`,
        transitionProperty: "height, background-color",
        transitionTimingFunction: RESOURCE_LIBRARY_TREE_EASING,
      }}
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
      {animatedItems.map(({ key, item, top, phase }) => (
        <ResourceLibraryTreeRow
          key={key}
          height={RESOURCE_LIBRARY_TREE_ROW_HEIGHT_PX}
          item={item}
          drag={drag}
          phase={phase}
          selectedPath={selectedPath}
          top={top}
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

  return (
    <ResourceLibraryTreeContent
      renderItems={renderItems}
      selectedPath={selectedPath}
      drag={ui.drag}
    />
  );
}
