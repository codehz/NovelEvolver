import type { ResourceTreeNode } from "@novelevolver/domain/worktree";
import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

import {
  SidebarHeaderActionButton,
  SidebarHeaderActions,
} from "#app/features/project-workbench/chrome";
import { runTreeRowContextMenu } from "#app/features/project-workbench/tree/run-tree-row-context-menu";
import type { TreeResolvedDrop } from "#app/features/project-workbench/tree/tree-drag";
import { findTreeRowDataAtPoint } from "#app/features/project-workbench/tree/tree-row-dom";
import { TreeBody } from "#app/features/project-workbench/tree/TreeBody";
import type { TreeDropResolveInput } from "#app/features/project-workbench/tree/use-tree-row-pointer-drag";
import { cn } from "#app/shared/lib/ui/cn";

import { manuscriptTreeMolecule } from "../manuscript/state/manuscript-tree-molecule";
import { useContentTreeReveal } from "../shared/content-tree-reveal";
import {
  explorerCrossDragMolecule,
  findExplorerDomainAtPoint,
} from "../shared/explorer-cross-drag";
import {
  collectExternalImportEntries,
  dataTransferHasFiles,
} from "../shared/external-import-collect";
import { resolveDropOntoManuscript } from "../shared/resolve-cross-domain-drop";
import { useExplorerTransfer } from "../shared/use-explorer-transfer";
import { resourceParentChain } from "./resource-tree";
import { buildResourceTreeContextMenuItems } from "./resource-tree-context-menu";
import {
  resolveExternalResourceDropTarget,
  resolveResourceDropTarget,
} from "./resource-tree-placement-policy";
import { buildResourceRenderProjection, type ResourceRenderItem } from "./resource-tree-projector";
import { ResourceLibraryTreeRow } from "./ResourceLibraryTreeRow";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { ResourceDropTarget } from "./state/types";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";
import { useResourceTreeSync } from "./state/use-resource-tree-sync";

const externalDropShellClass = cn("relative min-h-full");

function sameHighlightPreview(
  prev: TreeResolvedDrop<string> | null,
  next: TreeResolvedDrop<string> | null,
): boolean {
  if (prev?.target === next?.target && prev?.preview.kind === next?.preview.kind) {
    if (
      prev !== null &&
      next !== null &&
      prev.preview.kind === "highlight" &&
      next.preview.kind === "highlight" &&
      prev.preview.top === next.preview.top &&
      prev.preview.height === next.preview.height
    ) {
      return true;
    }
    if (prev === null && next === null) {
      return true;
    }
  }
  return false;
}

function sameCrossHover(
  prev: {
    targetParentId: string;
    index?: number;
    preview: TreeResolvedDrop<unknown>["preview"];
  } | null,
  next: {
    targetParentId: string;
    index?: number;
    preview: TreeResolvedDrop<unknown>["preview"];
  } | null,
): boolean {
  if (prev === next) {
    return true;
  }
  if (prev === null || next === null) {
    return false;
  }
  if (
    prev.targetParentId !== next.targetParentId ||
    prev.index !== next.index ||
    prev.preview.kind !== next.preview.kind
  ) {
    return false;
  }
  if (prev.preview.kind === "highlight" && next.preview.kind === "highlight") {
    return prev.preview.top === next.preview.top && prev.preview.height === next.preview.height;
  }
  if (prev.preview.kind === "insert" && next.preview.kind === "insert") {
    return (
      prev.preview.top === next.preview.top &&
      prev.preview.height === next.preview.height &&
      prev.preview.depth === next.preview.depth
    );
  }
  return false;
}

export function ResourceLibrarySectionBody() {
  useResourceTreeSync();
  const { treeAtom, onRevealRequest, retryPendingReveal } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const { treeAtom: manuscriptTreeAtom } = useMolecule(manuscriptTreeMolecule);
  const {
    sourceAtom: crossSourceAtom,
    hoverAtom: crossHoverAtom,
    domainRefs,
  } = useMolecule(explorerCrossDragMolecule);
  const state = useAtomValue(treeAtom);
  const crossHover = useAtomValue(crossHoverAtom);
  const dispatch = useSetAtom(treeAtom);
  const setCrossSource = useSetAtom(crossSourceAtom);
  const setCrossHover = useSetAtom(crossHoverAtom);
  const store = useStore();
  const listRef = useRef<HTMLUListElement>(null);
  const dropShellRef = useRef<HTMLDivElement>(null);
  const [externalDrop, setExternalDrop] = useState<TreeResolvedDrop<string> | null>(null);
  const projection = useMemo(() => buildResourceRenderProjection(state), [state]);
  const transferNode = useExplorerTransfer();
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

  useEffect(() => {
    domainRefs.resource.list = listRef.current;
    domainRefs.resource.shell = dropShellRef.current;
    return () => {
      domainRefs.resource.list = null;
      domainRefs.resource.shell = null;
    };
  });

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
      const domainAtPoint = findExplorerDomainAtPoint(input.clientX, input.clientY);
      if (domainAtPoint === "manuscript") {
        const resolved = resolveDropOntoManuscript({
          manuscriptState: store.get(manuscriptTreeAtom),
          clientX: input.clientX,
          clientY: input.clientY,
          manuscriptRefs: domainRefs.manuscript,
        });
        if (resolved === null) {
          setCrossHover(null);
          return null;
        }
        const transferTarget =
          resolved.target.kind === "insert"
            ? {
                mode: "transfer" as const,
                targetParentId: resolved.target.parentId,
                index: resolved.target.index,
              }
            : {
                mode: "transfer" as const,
                targetParentId: resolved.target.parentId,
              };
        setCrossHover((prev) => {
          const next = {
            domain: "manuscript" as const,
            preview: resolved.preview,
            targetParentId: transferTarget.targetParentId,
            index: transferTarget.index,
          };
          return sameCrossHover(prev, next) ? prev : next;
        });
        return {
          preview: resolved.preview,
          target: transferTarget,
        };
      }

      setCrossHover(null);
      const snapshot = store.get(treeAtom).snapshot;
      if (snapshot === null) {
        return null;
      }
      const local = resolveResourceDropTarget({
        snapshot,
        projection,
        ...input,
      });
      if (local === null) {
        return null;
      }
      return {
        preview: local.preview,
        target: { mode: "local" as const, targetParentId: local.target },
      };
    },
    [domainRefs, manuscriptTreeAtom, projection, setCrossHover, store, treeAtom],
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
      setExternalDrop((prev) => (sameHighlightPreview(prev, next) ? prev : next));
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

  const localDragPreview =
    state.drag?.resolved?.target.mode === "transfer"
      ? null
      : (state.drag?.resolved?.preview ?? null);
  const inboundCrossPreview = crossHover?.domain === "resource" ? crossHover.preview : null;
  const activeDropPreview =
    inboundCrossPreview ?? localDragPreview ?? externalDrop?.preview ?? null;
  const isDragging =
    state.drag !== null || externalDrop !== null || crossHover?.domain === "resource";

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
        data-explorer-domain="resource"
        onDragEnter={handleExternalDragOver}
        onDragOver={handleExternalDragOver}
        onDragLeave={handleExternalDragLeave}
        onDrop={handleExternalDrop}
      >
        <TreeBody<ResourceRenderItem, ResourceTreeNode["type"], ResourceDropTarget>
          listRef={listRef}
          status={state.status}
          isEmpty={projection.items.length === 0 && !isDragging}
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
              setCrossSource({ domain: "resource", sourceId, sourceType });
              dispatch({ type: "dragStart", sourceId, sourceType });
            },
            dispatchDragMove: (resolved) => {
              dispatch({ type: "dragMove", resolved });
            },
            dispatchDragEnd: () => {
              setCrossSource(null);
              setCrossHover(null);
              dispatch({ type: "dragEnd" });
            },
            commitResolvedDrop: async (drag) => {
              const target = drag.resolved.target;
              if (target.mode === "transfer") {
                await transferNode({
                  sourceDomain: "resource",
                  sourceId: drag.sourceId,
                  targetDomain: "manuscript",
                  targetParentId: target.targetParentId,
                  index: target.index,
                });
                return;
              }
              await moveNode(drag.sourceId, drag.sourceType, target.targetParentId);
            },
            shouldCommitDrop: (drag) =>
              drag.resolved.target.mode === "transfer" ||
              drag.resolved.target.targetParentId !== drag.sourceId,
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
