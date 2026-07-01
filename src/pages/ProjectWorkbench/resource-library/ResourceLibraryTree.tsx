import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { cn } from "#app/lib/cn";

import type { ResourceTreeNode } from "./resource-tree";
import { ResourceTreeInlineInput } from "./ResourceTreeInlineInput";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

function TreeNodeRow({
  depth,
  node,
  selectedPath,
  onActivate,
}: {
  depth: number;
  node: ResourceTreeNode;
  selectedPath: string | null;
  onActivate: (path: string, type: "file" | "folder") => void;
}) {
  const isFolder = node.type === "folder";
  const icon = isFolder
    ? node.expanded
      ? cn("icon-[codicon--folder-opened]")
      : cn("icon-[codicon--folder]")
    : cn("icon-[codicon--file]");
  const isSelected = selectedPath === node.path;

  return (
    <li role="none">
      <button
        className={cn(
          "flex w-full items-center gap-1 py-0.5 text-left text-app-foreground",
          isSelected ? "bg-workbench-tab-active" : "hover:bg-workbench-tab-active/60",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        type="button"
        onClick={() => onActivate(node.path, node.type)}
      >
        <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center text-sm">
          {isFolder &&
            (node.expanded ? (
              <span className={cn("icon-[codicon--chevron-down]")} />
            ) : (
              <span className={cn("icon-[codicon--chevron-right]")} />
            ))}
        </span>
        <span aria-hidden="true" className={cn(icon, "shrink-0 text-base")} />
        <span className="truncate">{node.name}</span>
        {node.loading ? <span className="ml-auto text-xs text-ctp-overlay0">…</span> : null}
      </button>
    </li>
  );
}

function TreeEditingRow({
  item,
  onCancelCreating,
  onConfirmCreating,
  onCancelRenaming,
  onConfirmRenaming,
}: {
  item: Extract<FlatRenderItem, { kind: "editing" }>;
  onCancelCreating: () => void;
  onConfirmCreating: (kind: "file" | "folder", parentPath: string, name: string) => Promise<void>;
  onCancelRenaming: () => void;
  onConfirmRenaming: (path: string, kind: "file" | "folder", name: string) => Promise<void>;
}) {
  const { editing, depth } = item;
  const initialValue = editing.mode === "renaming" ? editing.currentName : "";

  return (
    <li role="none">
      <div
        className={cn(
          "flex w-full items-center gap-1 py-0.5 text-app-foreground",
          "bg-workbench-tab-active/60",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span aria-hidden="true" className="flex w-4 shrink-0 items-center justify-center" />
        <span
          aria-hidden="true"
          className={cn(
            editing.kind === "folder" ? "icon-[codicon--folder]" : "icon-[codicon--file]",
            "shrink-0 text-base",
          )}
        />
        <ResourceTreeInlineInput
          initialValue={initialValue}
          kind={editing.kind}
          onCancel={() => {
            if (editing.mode === "creating") {
              onCancelCreating();
              return;
            }
            onCancelRenaming();
          }}
          onConfirm={(name) => {
            if (editing.mode === "creating") {
              void onConfirmCreating(editing.kind, editing.parentPath, name);
              return;
            }
            void onConfirmRenaming(editing.path, editing.kind, name);
          }}
        />
      </div>
    </li>
  );
}

function ResourceLibraryTreeContent({
  renderItems,
  selectedPath,
}: {
  renderItems: FlatRenderItem[];
  selectedPath: string | null;
}) {
  const {
    activateNode,
    cancelCreating,
    confirmCreating,
    startRenaming,
    cancelRenaming,
    confirmRenaming,
  } = useResourceLibraryTreeActions();

  return (
    <ul
      className="flex flex-col outline-none"
      role="tree"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "F2") {
          event.preventDefault();
          startRenaming();
        }
      }}
    >
      {renderItems.map((item) =>
        item.kind === "node" ? (
          <TreeNodeRow
            key={item.key}
            depth={item.depth}
            node={item.node}
            selectedPath={selectedPath}
            onActivate={activateNode}
          />
        ) : (
          <TreeEditingRow
            key={item.key}
            item={item}
            onCancelCreating={cancelCreating}
            onCancelRenaming={cancelRenaming}
            onConfirmCreating={confirmCreating}
            onConfirmRenaming={confirmRenaming}
          />
        ),
      )}
    </ul>
  );
}

export function ResourceLibraryTree() {
  const { treeDataAtom, flatRenderItemsAtom, selectedPathAtom } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const data = useAtomValue(treeDataAtom);
  const renderItems = useAtomValue(flatRenderItemsAtom);
  const selectedPath = useAtomValue(selectedPathAtom);

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

  return <ResourceLibraryTreeContent renderItems={renderItems} selectedPath={selectedPath} />;
}
