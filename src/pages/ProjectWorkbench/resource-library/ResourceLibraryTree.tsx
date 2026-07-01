import { useMolecule } from "bunshi/react";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import type { ResourceTreeNode } from "./resource-tree";
import { resourceLibraryTreeMolecule } from "./state/resource-tree-molecule";
import { useResourceLibraryTreeActions } from "./state/use-resource-library-tree-actions";

function CreatingTreeRow({
  kind,
  depth,
  onConfirm,
  onCancel,
}: {
  kind: "file" | "folder";
  depth: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const resolvedRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  const submit = useCallback(() => {
    if (resolvedRef.current) {
      return;
    }
    resolvedRef.current = true;
    const trimmed = value.trim();
    if (trimmed === "") {
      onCancel();
      return;
    }
    onConfirm(trimmed);
  }, [onCancel, onConfirm, value]);

  const cancel = useCallback(() => {
    if (resolvedRef.current) {
      return;
    }
    resolvedRef.current = true;
    onCancel();
  }, [onCancel]);

  const icon = kind === "folder" ? cn("icon-[codicon--folder]") : cn("icon-[codicon--file]");

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
        <span aria-hidden="true" className={cn(icon, "shrink-0 text-base")} />
        <input
          ref={inputRef}
          aria-label={kind === "file" ? "新文件名" : "新文件夹名"}
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 rounded-sm border border-badge-background bg-workbench-editor px-1 py-0 text-xs leading-tight text-app-foreground outline-none app-region-no-drag",
          )}
          placeholder={kind === "file" ? "例如 设定/世界观.md" : "例如 设定/资料"}
          spellCheck={false}
          type="text"
          value={value}
          onBlur={() => submit()}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cancel();
            }
          }}
        />
      </div>
    </li>
  );
}

function ResourceTreeRow({
  node,
  depth,
  selectedPath,
  onActivate,
}: {
  node: ResourceTreeNode;
  depth: number;
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

export function ResourceLibraryTree() {
  const { treeDataAtom, flatRenderItemsAtom, selectedPathAtom } = useMolecule(
    resourceLibraryTreeMolecule,
  );
  const data = useAtomValue(treeDataAtom);
  const renderItems = useAtomValue(flatRenderItemsAtom);
  const selectedPath = useAtomValue(selectedPathAtom);
  const { activateNode, cancelCreating, confirmCreating } = useResourceLibraryTreeActions();

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
    <ul className="flex flex-col" role="tree">
      {renderItems.map((item) =>
        item.kind === "creating" ? (
          <CreatingTreeRow
            key={item.key}
            depth={item.depth}
            kind={item.creating.kind}
            onCancel={cancelCreating}
            onConfirm={(name) =>
              void confirmCreating(item.creating.kind, item.creating.parentPath, name)
            }
          />
        ) : (
          <ResourceTreeRow
            key={item.key}
            depth={item.depth}
            node={item.node}
            selectedPath={selectedPath}
            onActivate={activateNode}
          />
        ),
      )}
    </ul>
  );
}
