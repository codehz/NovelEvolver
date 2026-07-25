import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { ResourceTreeNode } from "#shared/rpc/worktree/index";
import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";
import { runTreeRowContextMenu } from "#workbench/tree/run-tree-row-context-menu";
import type { TreeResolvedDrop } from "#workbench/tree/tree-drag";
import { findTreeRowDataAtPoint } from "#workbench/tree/tree-row-dom";
import { TreeBody } from "#workbench/tree/TreeBody";
import type { TreeDropResolveInput } from "#workbench/tree/use-tree-row-pointer-drag";

import { useContentTreeReveal } from "../shared/content-tree-reveal";
import {
  collectExternalImportEntries,
  dataTransferHasFiles,
} from "../shared/external-import-collect";
import { resourceParentChain } from "./resource-tree";
import { buildResourceTreeContextMenuItems } from "./resource-tree-context-menu";
import {
  resolveExternalResourceDropTarget,
  resolveResourceDropTarget,
} from "./resource-tree-placement-policy";
import { buildResourceRenderProjection, type ResourceRenderItem } from "./resource-tree-projector";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";
import { useResourceTreeSync } from "./state/use-resource-tree-sync";

const externalDropShellClass = cn("relative min-h-full");

export function ResourceLibrarySectionBody() {
  useResourceTreeSync();
  const { treeAtom, onRevealRequest, retryPendingReveal } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const state = useAtomValue(treeAtom);
  const dispatch = useSetAtom(treeAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const dropShellRef = useRef<HTMLDivElement>(null);
  const [externalDrop, setExternalDrop] = useState<TreeResolvedDrop<string> | null>(null);
  const projection = useMemo(() => buildResourceRenderProjection(state), [state]);
  const {
    startCreating,
    selectNode,
    activateNode,
    startRenaming,
    cancelEditing,
    submitEditing,
    deleteNode,
    moveNode,
    importExternalEntries,
  } = useResourceLibraryTreeActions();

  const handleRowContextMenu = useCallback(
    (id: string, type: ResourceTreeNode["type"], position: { x: number; y: number }) => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return;
      }
      const isRoot = id === snapshot.rootId;
      void runTreeRowContextMenu({
        items: buildResourceTreeContextMenuItems({ type, isRoot }),
        position,
        onBeforeOpen: () => {
          selectNode(id, type);
        },
        onSelect: async (actionId) => {
          switch (actionId) {
            case "open":
              activateNode(id, type, "", "open");
              return;
            case "new-file":
              startCreating("file");
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
      parentChain: resourceParentChain,
      revealRoot: (snapshot) => {
        dispatch({ type: "select", id: snapshot.rootId, nodeType: "folder" });
      },
      expandAncestors: (ancestorIds) => {
        if (ancestorIds.length > 0) {
          dispatch({ type: "expandPaths", ids: [...ancestorIds] });
        }
      },
      selectTarget: (targetId, item) => {
        dispatch({ type: "select", id: targetId, nodeType: item.type });
      },
    },
  });

  const resolveDropTarget = useCallback(
    (input: TreeDropResolveInput<ResourceTreeNode["type"]>) => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      return resolveResourceDropTarget({
        snapshot,
        projection,
        ...input,
      });
    },
    [projection, store, treeAtom],
  );

  const resolveExternalDropAtPoint = useCallback(
    (clientX: number, clientY: number): TreeResolvedDrop<string> | null => {
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      const hoveredRow = findTreeRowDataAtPoint<ResourceTreeNode["type"]>(
        clientX,
        clientY,
        listRef.current,
      );
      return resolveExternalResourceDropTarget({
        snapshot,
        projection,
        hoveredRow,
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
      setExternalDrop((prev) => {
        if (prev?.target === next?.target && prev?.preview.kind === next?.preview.kind) {
          if (
            prev !== null &&
            next !== null &&
            prev.preview.kind === "highlight" &&
            next.preview.kind === "highlight" &&
            prev.preview.top === next.preview.top &&
            prev.preview.height === next.preview.height
          ) {
            return prev;
          }
          if (prev === null && next === null) {
            return prev;
          }
        }
        return next;
      });
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
          return snapshot === null
            ? null
            : resolveExternalResourceDropTarget({
                snapshot,
                projection,
                hoveredRow: null,
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
          label="新建文件"
          icon="icon-[codicon--new-file]"
          onClick={() => {
            startCreating("file");
          }}
        />
        <SidebarHeaderActionButton
          label="新建文件夹"
          icon="icon-[codicon--new-folder]"
          onClick={() => {
            startCreating("folder");
          }}
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
        <TreeBody<ResourceRenderItem, ResourceTreeNode["type"], string>
          listRef={listRef}
          status={state.status}
          isEmpty={projection.items.length === 0}
          loadingContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">加载资源库…</p>}
          errorContent={
            state.error === null ? null : (
              <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
                {state.error}
              </p>
            )
          }
          emptyContent={<p className="px-2 py-1 text-xs text-ctp-subtext0">资源库为空。</p>}
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
              await moveNode(drag.sourceId, drag.sourceType, drag.resolved.target);
            },
            shouldCommitDrop: (drag) => drag.resolved.target !== drag.sourceId,
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
            <ResourceLibraryTreeRow
              dragging={dragging}
              index={index}
              item={item}
              layout={layout}
              listRef={rowListRef}
              resolveDropTarget={resolveDrop}
              selectedId={state.selected?.id ?? null}
              onActivate={activateNode}
              onCancelEditing={cancelEditing}
              onContextMenu={handleRowContextMenu}
              onDragEnd={onDragEnd}
              onDragMove={onDragMove}
              onDragStart={onDragStart}
              onSubmitEditing={submitEditing}
            />
          )}
        />
      </div>
    </>
  );
}
