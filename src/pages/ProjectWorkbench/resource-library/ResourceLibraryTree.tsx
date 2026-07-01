import type { ResourceNode } from "@shared/rpc/projects-rpc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { nodesToTreeChildren, setNodeAtPath, type ResourceTreeNode } from "./resource-tree";

type FlatTreeItem = { node: ResourceTreeNode; depth: number };

function flattenTree(nodes: ResourceTreeNode[], depth: number = 0): FlatTreeItem[] {
  const result: FlatTreeItem[] = [];
  for (const node of nodes) {
    result.push({ node, depth });
    if (node.type === "folder" && node.expanded && node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
}

export type CreatingState = {
  id: number;
  kind: "file" | "folder";
  parentPath: string;
};

type ResourceLibraryTreeProps = {
  listDirectory: (path: string) => Promise<ResourceNode[]>;
  onOpenFile: (path: string) => void;
  creating: CreatingState | null;
  onCreateConfirm: (kind: "file" | "folder", name: string) => void;
  onCreateCancel: () => void;
};

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
          "flex w-full items-center gap-0.5 py-0.5 pr-1 text-app-foreground",
          "bg-workbench-tab-active/60",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
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
          placeholder={kind === "file" ? "例如 设定/世界观.md" : "例如 设定"}
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
  onToggleFolder,
  onOpenFile,
}: {
  node: ResourceTreeNode;
  depth: number;
  onToggleFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
}) {
  const isFolder = node.type === "folder";
  const icon = isFolder
    ? node.expanded
      ? cn("icon-[codicon--folder-opened]")
      : cn("icon-[codicon--folder]")
    : cn("icon-[codicon--file]");

  return (
    <li role="none">
      <button
        className={cn(
          "flex w-full items-center gap-1 py-0.5 text-left text-app-foreground",
          "hover:bg-workbench-tab-active/60",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        type="button"
        onClick={() => {
          if (isFolder) {
            onToggleFolder(node.path);
            return;
          }
          onOpenFile(node.path);
        }}
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

export function ResourceLibraryTree({
  listDirectory,
  onOpenFile,
  creating,
  onCreateConfirm,
  onCreateCancel,
}: ResourceLibraryTreeProps) {
  const [roots, setRoots] = useState<ResourceTreeNode[]>([]);
  const [rootLoading, setRootLoading] = useState(true);
  const [rootError, setRootError] = useState<string | null>(null);

  const loadChildren = useCallback(
    async (path: string) => {
      setRoots((current) => setNodeAtPath(current, path, (node) => ({ ...node, loading: true })));
      try {
        const entries = await listDirectory(path);
        setRoots((current) =>
          setNodeAtPath(current, path, (node) => ({
            ...node,
            loading: false,
            children: nodesToTreeChildren(path, entries),
          })),
        );
      } catch (error) {
        setRoots((current) =>
          setNodeAtPath(current, path, (node) => ({ ...node, loading: false })),
        );
        setRootError(error instanceof Error ? error.message : String(error));
      }
    },
    [listDirectory],
  );

  useEffect(() => {
    let canceled = false;
    setRootLoading(true);
    setRootError(null);
    void listDirectory("")
      .then((entries) => {
        if (!canceled) {
          setRoots(nodesToTreeChildren("", entries));
        }
      })
      .catch((error) => {
        if (!canceled) {
          setRootError(error instanceof Error ? error.message : String(error));
          setRoots([]);
        }
      })
      .finally(() => {
        if (!canceled) {
          setRootLoading(false);
        }
      });
    return () => {
      canceled = true;
    };
  }, [listDirectory]);

  const onToggleFolder = useCallback(
    (path: string) => {
      setRoots((current) => {
        const node = findNode(current, path);
        if (!node || node.type !== "folder") {
          return current;
        }
        const nextExpanded = !node.expanded;
        const updated = setNodeAtPath(current, path, (n) => ({
          ...n,
          expanded: nextExpanded,
        }));
        if (nextExpanded && node.children === null) {
          void loadChildren(path);
        }
        return updated;
      });
    },
    [loadChildren],
  );

  const flatItems = useMemo(() => flattenTree(roots), [roots]);

  const renderItems = useMemo(() => {
    const items: Array<
      | { key: string; kind: "node"; node: ResourceTreeNode; depth: number }
      | { key: string; kind: "creating"; creating: CreatingState; depth: number }
    > = flatItems.map(({ node, depth }) => ({
      key: node.path,
      kind: "node" as const,
      node,
      depth,
    }));

    if (creating) {
      const prefix = creating.parentPath === "" ? "" : `${creating.parentPath}/`;
      let insertAt = 0;
      let depth = 0;
      if (creating.parentPath !== "") {
        // Find the last direct child of parentPath to determine insert position
        let lastChildIdx = -1;
        for (let i = 0; i < flatItems.length; i++) {
          const p = flatItems[i].node.path;
          if (p.startsWith(prefix) && !p.slice(prefix.length).includes("/")) {
            lastChildIdx = i;
          }
        }
        if (lastChildIdx >= 0) {
          insertAt = lastChildIdx + 1;
          depth = flatItems[lastChildIdx].depth;
        } else {
          const parentIdx = flatItems.findIndex((item) => item.node.path === creating.parentPath);
          insertAt = parentIdx >= 0 ? parentIdx + 1 : 0;
          depth = parentIdx >= 0 ? flatItems[parentIdx].depth + 1 : 0;
        }
      }
      items.splice(insertAt, 0, {
        key: `creating-${creating.id}`,
        kind: "creating",
        creating,
        depth,
      });
    }

    return items;
  }, [flatItems, creating]);

  if (rootLoading) {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">加载资源库…</p>;
  }

  if (rootError) {
    return (
      <p className="px-2 py-1 text-xs text-ctp-red" role="alert">
        {rootError}
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
            onCancel={onCreateCancel}
            onConfirm={(name) => onCreateConfirm(item.creating.kind, name)}
          />
        ) : (
          <ResourceTreeRow
            key={item.key}
            depth={item.depth}
            node={item.node}
            onOpenFile={onOpenFile}
            onToggleFolder={onToggleFolder}
          />
        ),
      )}
    </ul>
  );
}

function findNode(nodes: ResourceTreeNode[], path: string): ResourceTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
