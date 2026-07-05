import { useCallback, useEffect, useMemo, useState } from "react";

import { ScrollArea } from "#app/components/ScrollArea";
import { cn } from "#app/lib/cn";
import type { NodeDiff, ResourceDiffEntry, WorktreeDiffResult } from "#shared/rpc/worktree-diff";

import { useWorktreeDiff } from "../branch/branch-scopes";

// ==================== Stats badge ====================

function DiffStats({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="shrink-0 font-mono text-[10px] leading-none">
      {added > 0 ? <span className="text-ctp-green">+{added}</span> : null}
      {removed > 0 ? <span className="text-ctp-red"> -{removed}</span> : null}
    </span>
  );
}

// ==================== Tree node model ====================

type DiffTreeNode = {
  label: string;
  depth: number;
  diff?: NodeDiff | ResourceDiffEntry;
  children: DiffTreeNode[];
  /** 是否为目录节点（有子节点） */
  isDir: boolean;
  /** 稳定的树路径 ID（用于展开状态追踪） */
  treePath: string;
};

// ==================== 正文树构建 ====================

function buildManuscriptTree(nodes: NodeDiff[]): DiffTreeNode[] {
  if (nodes.length === 0) return [];

  // 收集有变更的节点 ID
  const changedIds = new Set(nodes.map((n) => n.id));

  // 通过 diff 的 parent 信息推导路径
  // 先构建 id → diff 映射
  const diffById = new Map(nodes.map((n) => [n.id, n]));

  // 构建目录树：每个节点需要知道其父节点
  // 对于新增节点，parent 来自 diff.parent
  // 对于删除节点，parent 来自 diff.base.parent
  // 对于修改节点，parent 来自 diff.parent
  const parentMap = new Map<string, string | null>();
  for (const n of nodes) {
    if (n.base !== null) {
      // 节点在 base 中存在，用 base 的 parent
      parentMap.set(n.id, n.base.parent);
    } else {
      // 新增节点，用 current parent
      parentMap.set(n.id, n.parent);
    }
  }

  // 收集所有需要显示的 ID（变更节点 + 所有祖先）
  const requiredIds = new Set<string>();
  for (const id of changedIds) {
    let current: string | undefined = id;
    while (current !== undefined && current !== null) {
      if (requiredIds.has(current)) break;
      requiredIds.add(current);
      current = parentMap.get(current) ?? undefined;
    }
  }

  // 构建 childrenMap
  const childrenMap = new Map<string, string[]>();
  for (const [childId, parentId] of parentMap) {
    if (parentId === null || parentId === undefined) continue;
    if (!requiredIds.has(childId)) continue;
    if (!requiredIds.has(parentId)) continue;
    let siblings = childrenMap.get(parentId);
    if (siblings === undefined) {
      siblings = [];
      childrenMap.set(parentId, siblings);
    }
    siblings.push(childId);
  }

  // 递归构建树
  const buildNode = (id: string, depth: number, parentPath: string): DiffTreeNode | null => {
    if (!requiredIds.has(id)) return null;

    const diff = diffById.get(id);
    const label = diff?.title ?? diff?.base?.title ?? id;
    const nodePath = `${parentPath}/${id}`;
    const childIds = childrenMap.get(id) ?? [];
    const children = childIds
      .map((childId) => buildNode(childId, depth + 1, nodePath))
      .filter((n): n is DiffTreeNode => n !== null);

    return {
      label,
      depth,
      diff,
      children,
      isDir: children.length > 0 || diff?.type === "folder",
      treePath: nodePath,
    };
  };

  // 找到根节点（parent 为 null 的节点）
  const rootIds: string[] = [];
  for (const [id, parentId] of parentMap) {
    if (parentId === null && requiredIds.has(id)) {
      rootIds.push(id);
    }
  }

  const roots: DiffTreeNode[] = [];
  for (const rootId of rootIds) {
    const node = buildNode(rootId, 0, "m");
    if (node !== null) {
      roots.push(node);
    }
  }

  return roots;
}

// ==================== 资源树构建 ====================

function buildResourceTree(entries: ResourceDiffEntry[]): DiffTreeNode[] {
  if (entries.length === 0) return [];

  const root: DiffTreeNode = { label: "", depth: -1, children: [], isDir: true, treePath: "r" };

  for (const entry of entries) {
    const segments = entry.path.split("/");
    let current = root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;
      const childPath = `${current.treePath}/${segment}`;
      let child = current.children.find((c) => c.label === segment);

      if (child === undefined) {
        // 末尾节点的 isDir 由 entry 的 resourceKind 决定；中间节点一定是目录
        const isFolderEntry =
          isLast &&
          "resourceKind" in entry &&
          (entry as { resourceKind?: string }).resourceKind === "folder";
        child = {
          label: segment,
          depth: current.depth + 1,
          children: [],
          isDir: isFolderEntry || !isLast,
          diff: isLast ? entry : undefined,
          treePath: childPath,
        };
        current.children.push(child);
      } else if (isLast) {
        child.diff = entry;
      }

      current = child;
    }
  }

  return root.children;
}

// ==================== 树节点渲染 ====================

function DiffTreeNodeRow({
  node,
  expanded,
  onToggle,
}: {
  node: DiffTreeNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const diff = node.diff;

  // 目录节点（无直接 diff，仅作为路径容器）
  if (node.isDir && diff === undefined) {
    return (
      <li
        className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
        style={{ paddingLeft: `${(node.depth + 1) * 12}px` }}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        role="treeitem"
        aria-expanded={expanded}
        tabIndex={0}
      >
        <span
          className={cn(
            "icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0 transition-transform",
            expanded && "rotate-90",
          )}
        />
        <span className="icon-[codicon--folder] shrink-0 text-sm text-ctp-mauve" />
        <span className="truncate text-ctp-subtext0">{node.label}</span>
      </li>
    );
  }

  // 变更节点
  if (diff !== undefined && "id" in diff) {
    return (
      <ManuscriptChangeRow diff={diff} depth={node.depth} expanded={expanded} onToggle={onToggle} />
    );
  }

  if (diff !== undefined && "path" in diff) {
    return (
      <ResourceChangeRow
        node={node}
        entry={diff}
        depth={node.depth}
        isDir={node.isDir}
        expanded={expanded}
        onToggle={onToggle}
      />
    );
  }

  // 目录节点（有子变更，自身无 diff）
  return (
    <li
      className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
      style={{ paddingLeft: `${(node.depth + 1) * 12}px` }}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggle();
      }}
      role="treeitem"
      aria-expanded={expanded}
      tabIndex={0}
    >
      <span
        className={cn(
          "icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0 transition-transform",
          expanded && "rotate-90",
        )}
      />
      <span className="icon-[codicon--folder] shrink-0 text-sm text-ctp-mauve" />
      <span className="truncate text-ctp-subtext0">{node.label}</span>
    </li>
  );
}

// ==================== Manuscript change row ====================

function ManuscriptChangeRow({
  diff,
  depth,
  expanded,
  onToggle,
}: {
  diff: NodeDiff;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = diff.type === "folder";

  const typeIcon = hasChildren ? "icon-[codicon--folder]" : "icon-[codicon--file]";

  // 被删除的节点
  if (diff.title === null) {
    return (
      <li
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-ctp-subtext0"
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {hasChildren ? (
          <span
            className={cn(
              "icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0 transition-transform",
              expanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className={cn(typeIcon, "shrink-0 text-sm text-ctp-overlay0")} />
        <span className="truncate line-through opacity-60">{diff.base?.title ?? diff.id}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {diff.base?.content !== null && diff.base?.content !== undefined ? (
            <DiffStats added={0} removed={diff.base.content.length} />
          ) : null}
          <span className="icon-[codicon--diff-removed] shrink-0 text-sm text-ctp-red" />
        </span>
      </li>
    );
  }

  // 新增的节点
  if (diff.base === null) {
    return (
      <li
        className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-ctp-subtext1"
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      >
        {hasChildren ? (
          <span
            className={cn(
              "icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0 transition-transform",
              expanded && "rotate-90",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className={cn(typeIcon, "shrink-0 text-sm text-ctp-overlay0")} />
        <span className="truncate">{diff.title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {diff.contentChanged !== undefined ? (
            <DiffStats
              added={diff.contentChanged.stats.added}
              removed={diff.contentChanged.stats.removed}
            />
          ) : null}
          <span className="icon-[codicon--diff-added] shrink-0 text-sm text-ctp-green" />
        </span>
      </li>
    );
  }

  // 修改的节点
  const changes: string[] = [];
  if (diff.titleChanged !== undefined) changes.push("重命名");
  if (diff.parentChanged !== undefined) changes.push("移动");
  if (diff.contentChanged !== undefined) changes.push("内容");
  if (diff.childrenChanged !== undefined) changes.push("子节点");

  const stats = diff.contentChanged?.stats;

  return (
    <li
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-ctp-subtext1"
      style={{ paddingLeft: `${(depth + 1) * 12}px` }}
    >
      {hasChildren ? (
        <span
          className={cn(
            "icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0 transition-transform",
            expanded && "rotate-90",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <span className={cn(typeIcon, "shrink-0 text-sm text-ctp-overlay0")} />
      <span className="truncate">{diff.title}</span>
      {changes.length > 0 ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">{changes.join(", ")}</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {stats !== undefined ? <DiffStats added={stats.added} removed={stats.removed} /> : null}
        <span className="icon-[codicon--diff-modified] shrink-0 text-sm text-ctp-yellow" />
      </span>
    </li>
  );
}

// ==================== Resource change row ====================

function ResourceChangeRow({
  node,
  entry,
  depth,
  isDir,
  expanded,
  onToggle,
}: {
  node: DiffTreeNode;
  entry: ResourceDiffEntry;
  depth: number;
  isDir: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const iconName =
    entry.kind === "added"
      ? "icon-[codicon--diff-added]"
      : entry.kind === "removed"
        ? "icon-[codicon--diff-removed]"
        : "icon-[codicon--diff-modified]";

  const iconColor =
    entry.kind === "added"
      ? "text-ctp-green"
      : entry.kind === "removed"
        ? "text-ctp-red"
        : "text-ctp-yellow";

  const fileIcon = isDir ? "icon-[codicon--folder]" : "icon-[codicon--file]";

  const stats = "stats" in entry ? entry.stats : undefined;

  return (
    <li
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-ctp-subtext1"
      style={{ paddingLeft: `${(depth + 1) * 12}px` }}
    >
      {isDir ? (
        <span
          className={cn(
            "icon-[codicon--chevron-right] shrink-0 text-sm text-ctp-overlay0 transition-transform",
            expanded && "rotate-90",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <span className={cn(fileIcon, "shrink-0 text-sm text-ctp-overlay0")} />
      <span className="truncate">{node.label}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {stats !== undefined ? <DiffStats added={stats.added} removed={stats.removed} /> : null}
        <span className={cn(iconName, "shrink-0 text-sm", iconColor)} />
      </span>
    </li>
  );
}

// ==================== Recursive tree renderer ====================

function DiffTreeView({
  nodes,
  expandedIds,
  onToggle,
}: {
  nodes: DiffTreeNode[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col" role="tree">
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.treePath);

        return (
          <li
            key={node.treePath}
            role="treeitem"
            aria-expanded={node.isDir ? isExpanded : undefined}
          >
            <DiffTreeNodeRow
              node={node}
              expanded={isExpanded}
              onToggle={() => onToggle(node.treePath)}
            />
            {node.isDir && isExpanded && node.children.length > 0 ? (
              <DiffTreeView nodes={node.children} expandedIds={expandedIds} onToggle={onToggle} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ==================== Empty / Loading / Error states ====================

function DiffEmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--check] text-2xl text-ctp-green" />
      <p>没有变更。</p>
    </div>
  );
}

function DiffLoading() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--loading] animate-spin text-2xl" />
      <p>正在计算差异…</p>
    </div>
  );
}

function DiffError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-ctp-subtext0">
      <span aria-hidden="true" className="icon-[codicon--error] text-2xl text-ctp-red" />
      <p>无法加载差异信息。</p>
      <button
        type="button"
        className="text-xs text-ctp-mauve underline-offset-2 hover:underline"
        onClick={onRetry}
      >
        重试
      </button>
    </div>
  );
}

// ==================== Main component ====================

export function ScmSidebarSection() {
  const diffHandle = useWorktreeDiff();
  const [result, setResult] = useState<WorktreeDiffResult | null>(null);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    diffHandle
      .compute()
      .then((data) => {
        setResult(data);
        setLoading(false);
        // 默认展开所有顶层目录
        const newExpanded = new Set<string>();
        // 正文根节点默认展开
        if (data.manuscript.nodes.length > 0) {
          for (const node of data.manuscript.nodes) {
            if (node.base?.parent === null || node.parent === null) {
              newExpanded.add(`m/${node.id}`);
            }
          }
        }
        // 资源顶层目录默认展开
        if (data.resources.length > 0) {
          for (const entry of data.resources) {
            const segments = entry.path.split("/");
            if (segments.length > 1) {
              newExpanded.add(`r/${segments[0]}`);
            }
          }
        }
        setExpandedIds(newExpanded);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [diffHandle]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const manuscriptNodes = result?.manuscript.nodes ?? [];
  const resourceEntries = result?.resources ?? [];
  const manuscriptTree = useMemo(() => buildManuscriptTree(manuscriptNodes), [manuscriptNodes]);
  const resourceTree = useMemo(() => buildResourceTree(resourceEntries), [resourceEntries]);

  if (loading) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffLoading />
      </ScrollArea>
    );
  }

  if (error) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffError onRetry={load} />
      </ScrollArea>
    );
  }

  if (result === null) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffEmptyState />
      </ScrollArea>
    );
  }

  const hasChanges = manuscriptNodes.length > 0 || resourceEntries.length > 0;

  if (!hasChanges) {
    return (
      <ScrollArea className="-m-2 min-h-0 flex-1" fill>
        <DiffEmptyState />
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="-m-2 min-h-0 flex-1" fill>
      <div className="flex flex-col gap-0.5 py-1">
        {/* 正文变更 */}
        {manuscriptTree.length > 0 ? (
          <section>
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
              <span className="icon-[codicon--symbol-method] shrink-0 text-sm" />
              正文变更
              <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
                {manuscriptNodes.length}
              </span>
            </div>
            <DiffTreeView
              nodes={manuscriptTree}
              expandedIds={expandedIds}
              onToggle={toggleExpand}
            />
          </section>
        ) : null}

        {/* 资源变更 */}
        {resourceTree.length > 0 ? (
          <section>
            <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ctp-mauve uppercase">
              <span className="icon-[codicon--symbol-file] shrink-0 text-sm" />
              资源变更
              <span className="ml-0.5 rounded bg-ctp-surface0 px-1 py-px font-mono text-ctp-subtext0">
                {resourceEntries.length}
              </span>
            </div>
            <DiffTreeView nodes={resourceTree} expandedIds={expandedIds} onToggle={toggleExpand} />
          </section>
        ) : null}
      </div>
    </ScrollArea>
  );
}
