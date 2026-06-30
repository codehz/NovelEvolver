import type { ResourceNode } from "@shared/rpc/projects-rpc";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/cn";

import { nodesToTreeChildren, setNodeAtPath, type ResourceTreeNode } from "./resource-tree";

type ResourceLibraryTreeProps = {
  listDirectory: (path: string) => Promise<ResourceNode[]>;
  onOpenFile: (path: string) => void;
};

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
    <>
      <li role="none">
        <button
          className={cn(
            "flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-app-foreground",
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
          <span aria-hidden="true" className={cn(icon, "shrink-0 text-base")} />
          <span className="truncate">{node.name}</span>
          {node.loading ? <span className="ml-auto text-xs text-ctp-overlay0">…</span> : null}
        </button>
      </li>
      {isFolder && node.expanded && node.children
        ? node.children.map((child) => (
            <ResourceTreeRow
              key={child.path}
              depth={depth + 1}
              node={child}
              onOpenFile={onOpenFile}
              onToggleFolder={onToggleFolder}
            />
          ))
        : null}
    </>
  );
}

export function ResourceLibraryTree({ listDirectory, onOpenFile }: ResourceLibraryTreeProps) {
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

  if (roots.length === 0) {
    return <p className="px-2 py-1 text-xs text-ctp-subtext0">资源库为空。</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5 p-1" role="tree">
      {roots.map((node) => (
        <ResourceTreeRow
          key={node.path}
          depth={0}
          node={node}
          onOpenFile={onOpenFile}
          onToggleFolder={onToggleFolder}
        />
      ))}
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
