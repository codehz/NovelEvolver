import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";

import { cn } from "#app/lib/cn";

import { ResourceTreeInlineInput } from "./ResourceTreeInlineInput";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import type { FlatRenderItem } from "./state/tree-data-reducer";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

function TreeRow({
  item,
  selectedPath,
  onActivate,
  onCancelEditing,
  onSubmitEditing,
}: {
  item: FlatRenderItem;
  selectedPath: string | null;
  onActivate: (path: string, type: "file" | "folder") => void;
  onCancelEditing: () => void;
  onSubmitEditing: (editing: NonNullable<FlatRenderItem["editing"]>, name: string) => Promise<void>;
}) {
  const isFolder = item.type === "folder";
  const icon = isFolder
    ? item.expanded
      ? cn("icon-[codicon--folder-opened]")
      : cn("icon-[codicon--folder]")
    : cn("icon-[codicon--file]");
  const isSelected = item.path !== null && selectedPath === item.path;
  const isEditing = item.editing !== null;
  const rowClasses = cn(
    "flex min-h-6 w-full items-center gap-1 text-left text-app-foreground",
    isSelected || isEditing ? "bg-workbench-tab-active" : "hover:bg-workbench-tab-active/60",
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
          style={{ paddingLeft: `${item.depth * 12 + 4}px` }}
          type="button"
          onClick={() => {
            if (item.path === null) {
              return;
            }
            onActivate(item.path, item.type);
          }}
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
}: {
  renderItems: FlatRenderItem[];
  selectedPath: string | null;
}) {
  const { activateNode, startRenaming, cancelEditing, submitEditing } =
    useResourceLibraryTreeActions();

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
      {renderItems.map((item) => (
        <TreeRow
          key={item.key}
          item={item}
          selectedPath={selectedPath}
          onActivate={activateNode}
          onCancelEditing={cancelEditing}
          onSubmitEditing={submitEditing}
        />
      ))}
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
