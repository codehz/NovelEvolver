import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { ManuscriptTreeNode } from "#shared/rpc/worktree/index";
import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";
import { runTreeRowContextMenu } from "#workbench/tree/run-tree-row-context-menu";
import type { TreeResolvedDrop } from "#workbench/tree/tree-drag";
import { resolveHoverZone } from "#workbench/tree/tree-drag";
import { findTreeRowDataAtPoint } from "#workbench/tree/tree-row-dom";
import { TreeBody } from "#workbench/tree/TreeBody";
import type { TreeDropResolveInput } from "#workbench/tree/use-tree-row-pointer-drag";

import { useContentTreeReveal } from "../shared/content-tree-reveal";
import {
  collectExternalImportEntries,
  dataTransferHasFiles,
} from "../shared/external-import-collect";
import { manuscriptParentChain } from "./manuscript-tree";
import { buildManuscriptTreeContextMenuItems } from "./manuscript-tree-context-menu";
import {
  resolveExternalManuscriptDropTarget,
  resolveManuscriptDropTarget,
} from "./manuscript-tree-placement-policy";
import {
  buildManuscriptRenderProjection,
  type ManuscriptRenderItem,
} from "./manuscript-tree-projector";
import { ManuscriptTreeRow } from "./ManuscriptTreeRow";
import { manuscriptTreeMolecule } from "./state/manuscript-tree-molecule";
import type { ManuscriptMoveTarget } from "./state/types";
import { useManuscriptTreeActions } from "./state/use-manuscript-tree-actions";
import { useManuscriptTreeSync } from "./state/use-manuscript-tree-sync";

const externalDropShellClass = cn("relative min-h-full");

function sameInsertPreview(
  prev: TreeResolvedDrop<ManuscriptMoveTarget> | null,
  next: TreeResolvedDrop<ManuscriptMoveTarget> | null,
): boolean {
  if (prev === next) {
    return true;
  }
  if (prev === null || next === null) {
    return false;
  }
  if (prev.target.kind !== next.target.kind || prev.target.parentId !== next.target.parentId) {
    return false;
  }
  if (prev.target.kind === "insert" && next.target.kind === "insert") {
    if (prev.target.index !== next.target.index) {
      return false;
    }
  }
  if (prev.preview.kind !== next.preview.kind) {
    return false;
  }
  if (prev.preview.kind === "insert" && next.preview.kind === "insert") {
    return (
      prev.preview.top === next.preview.top &&
      prev.preview.height === next.preview.height &&
      prev.preview.depth === next.preview.depth
    );
  }
  if (prev.preview.kind === "highlight" && next.preview.kind === "highlight") {
    return prev.preview.top === next.preview.top && prev.preview.height === next.preview.height;
  }
  return false;
}

export function ManuscriptSectionBody() {
  useManuscriptTreeSync();
  const { treeAtom, onRevealRequest, retryPendingReveal } = useMolecule(manuscriptTreeMolecule);
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const dropShellRef = useRef<HTMLDivElement>(null);
  const [externalDrop, setExternalDrop] = useState<TreeResolvedDrop<ManuscriptMoveTarget> | null>(
    null,
  );
  const projection = useMemo(() => buildManuscriptRenderProjection(state), [state]);
  const {
    startCreating,
    startRenaming,
    cancelEditing,
    submitEditing,
    selectNode,
    activateNode,
    deleteNode,
    moveNode,
    importExternalEntries,
  } = useManuscriptTreeActions();

  const handleRowContextMenu = useCallback(
    (id: string, type: ManuscriptTreeNode["type"], position: { x: number; y: number }) => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return;
      }
      const isRoot = id === snapshot.rootId;
      void runTreeRowContextMenu({
        items: buildManuscriptTreeContextMenuItems({ type, isRoot }),
        position,
        onBeforeOpen: () => {
          selectNode(id);
        },
        onSelect: async (actionId) => {
          switch (actionId) {
            case "open":
              activateNode(id, type, "", "open");
              return;
            case "new-chapter":
              startCreating("chapter");
              return;
            case "new-folder":
              startCreating("folder");
              return;
            case "rename":
              startRenaming();
              return;
            case "delete":
              await deleteNode();
              return;
            default:
              return;
          }
        },
      });
    },
    [activateNode, deleteNode, selectNode, startCreating, startRenaming, store, treeAtom],
  );

  useContentTreeReveal({
    snapshot: state.snapshot,
    projection,
    listRef,
    onRevealRequest,
    retryPendingReveal,
    handlers: {
      parentChain: manuscriptParentChain,
      revealRoot: (snapshot) => {
        dispatch({ type: "expand", id: snapshot.rootId });
        dispatch({ type: "select", id: snapshot.rootId });
      },
      expandAncestors: (ancestorIds) => {
        for (const ancestorId of ancestorIds) {
          dispatch({ type: "expand", id: ancestorId });
        }
      },
      selectTarget: (targetId) => {
        dispatch({ type: "select", id: targetId });
      },
    },
  });

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<ManuscriptTreeNode["type"]>) => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      return resolveManuscriptDropTarget({
        snapshot,
        projection,
        ...input,
      });
    },
    [projection, store, treeAtom],
  );

  const resolveExternalDropAtPoint = useCallback(
    (clientX: number, clientY: number): TreeResolvedDrop<ManuscriptMoveTarget> | null => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      const listElement = listRef.current;
      const hoveredRow = findTreeRowDataAtPoint<ManuscriptTreeNode["type"]>(
        clientX,
        clientY,
        listElement,
      );
      return resolveExternalManuscriptDropTarget({
        snapshot,
        projection,
        hoveredRow,
        hoverZone: hoveredRow === null ? null : resolveHoverZone(clientY, hoveredRow.rect),
        listRect: listElement?.getBoundingClientRect() ?? null,
        clientY,
      });
    },
    [projection, store, treeAtom],
  );

  const handleExternalDragOver = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!dataTransferHasFiles(event.dataTransfer) || store.get(treeAtom).drag !== null) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      const next = resolveExternalDropAtPoint(event.clientX, event.clientY);
      setExternalDrop((prev) => (sameInsertPreview(prev, next) ? prev : next));
    },
    [resolveExternalDropAtPoint, store, treeAtom],
  );

  const handleExternalDragLeave = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      dropShellRef.current !== null &&
      dropShellRef.current.contains(nextTarget)
    ) {
      return;
    }
    setExternalDrop(null);
  }, []);

  const handleExternalDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!dataTransferHasFiles(event.dataTransfer) || store.get(treeAtom).drag !== null) {
        return;
      }
      event.preventDefault();
      const target =
        resolveExternalDropAtPoint(event.clientX, event.clientY) ??
        (() => {
          const snapshot = store.get(treeAtom).snapshot;
          if (snapshot === null) {
            return null;
          }
          return resolveExternalManuscriptDropTarget({
            snapshot,
            projection,
            hoveredRow: null,
            hoverZone: null,
            listRect: listRef.current?.getBoundingClientRect() ?? null,
            clientY: event.clientY,
          });
        })();
      setExternalDrop(null);
      if (target === null) {
        return;
      }
      const dataTransfer = event.dataTransfer;
      void (async () => {
        const collected = await collectExternalImportEntries(dataTransfer);
        await importExternalEntries(target.target, collected.entries, collected.skipped);
      })();
    },
    [importExternalEntries, projection, resolveExternalDropAtPoint, store, treeAtom],
  );

  const activeDropPreview = state.drag?.resolved?.preview ?? externalDrop?.preview ?? null;
  const isDragging = state.drag !== null || externalDrop !== null;

  return (
    <>
      <SidebarHeaderActions>
        <SidebarHeaderActionButton
          label="新建章节"
          icon="icon-[codicon--new-file]"
          onClick={() => startCreating("chapter")}
        />
        <SidebarHeaderActionButton
          label="新建文件夹"
          icon="icon-[codicon--new-folder]"
          onClick={() => startCreating("folder")}
        />
      </SidebarHeaderActions>
      <div
        ref={dropShellRef}
        className={externalDropShellClass}
        onDragEnter={handleExternalDragOver}
        onDragOver={handleExternalDragOver}
        onDragLeave={handleExternalDragLeave}
        onDrop={handleExternalDrop}
      >
        <TreeBody<ManuscriptRenderItem, ManuscriptTreeNode["type"], ManuscriptMoveTarget>
          listRef={listRef}
          status={state.status}
          isEmpty={projection.items.length === 0}
          loadingContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">加载正文…</p>}
          errorContent={
            state.error === null ? null : (
              <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
                {state.error}
              </p>
            )
          }
          emptyContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">正文为空。</p>}
          items={projection.items}
          getItemKey={(item) => item.key}
          dropPreview={activeDropPreview}
          dragging={isDragging}
          onRequestRename={startRenaming}
          onRequestDelete={deleteNode}
          dragController={{
            getCurrentDrag: () => store.get(treeAtom).drag,
            dispatchDragStart: (sourceId, sourceType) => {
              dispatch({ type: "dragStart", sourceId, sourceType });
            },
            dispatchDragMove: (resolved) => {
              dispatch({ type: "dragMove", resolved });
            },
            dispatchDragEnd: () => {
              dispatch({ type: "dragEnd" });
            },
            commitResolvedDrop: async (drag) => {
              if (drag.resolved.target.kind === "into") {
                await moveNode(drag.sourceId, drag.resolved.target.parentId);
                return;
              }
              await moveNode(
                drag.sourceId,
                drag.resolved.target.parentId,
                drag.resolved.target.index,
              );
            },
            resolveDropTarget,
          }}
          renderRow={({
            item,
            index,
            layout,
            listRef: rowListRef,
            dragging,
            resolveDropTarget: resolveDrop,
            onDragStart,
            onDragMove,
            onDragEnd,
          }) => (
            <ManuscriptTreeRow
              id={item.id}
              title={item.title}
              type={item.type}
              depth={item.depth}
              expanded={item.expanded}
              index={index}
              layout={layout}
              selected={item.id !== null && item.id === state.selectedId}
              editing={item.editing}
              dragging={dragging}
              changeStatus={item.changeStatus}
              listRef={rowListRef}
              resolveDropTarget={resolveDrop}
              onActivate={activateNode}
              onCancelEditing={cancelEditing}
              onContextMenu={handleRowContextMenu}
              onSubmitEditing={submitEditing}
              onDragStart={onDragStart}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
            />
          )}
        />
      </div>
    </>
  );
}
