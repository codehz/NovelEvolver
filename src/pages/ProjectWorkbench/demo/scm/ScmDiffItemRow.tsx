import { useState } from "react";

import { cn } from "#app/lib/cn";
import type { ScmChange } from "#shared/rpc/worktree-scm";

import { ScmDiffStats } from "./ScmDiffStats";

function scmChangeKindIconClass(kind: ScmChange["kind"]): string {
  return cn(
    kind === "create" && "icon-[codicon--diff-added] text-ctp-green",
    kind === "delete" && "icon-[codicon--diff-removed] text-ctp-red",
    kind === "content" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "rename" && "icon-[codicon--edit] text-ctp-yellow",
    kind === "move" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "reorder" && "icon-[codicon--list-flat] text-ctp-subtext0",
  );
}

function scmEntityIconClass(entityKind: ScmChange["entityKind"]): string {
  return entityKind === "folder"
    ? "icon-[codicon--folder] text-ctp-mauve"
    : "icon-[codicon--file] text-ctp-overlay0";
}

export function ScmDiffItemRow({
  item,
  onRevert,
}: {
  item: ScmChange;
  onRevert: (changeId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <li
      className="flex h-6 items-center gap-1 rounded px-2 text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50"
      style={{ paddingLeft: `${(item.depth + 1) * 12}px` }}
      role="treeitem"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className={cn(scmEntityIconClass(item.entityKind), "shrink-0 text-sm")} />
      <span className="truncate">{item.label}</span>
      {item.kind === "reorder" ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">顺序</span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {!hovered && item.stats !== undefined ? (
          <ScmDiffStats added={item.stats.added} removed={item.stats.removed} />
        ) : null}
        {!hovered ? (
          <span className={cn(scmChangeKindIconClass(item.kind), "shrink-0 text-sm")} />
        ) : null}
        {hovered ? (
          <button
            type="button"
            className="size-5 shrink-0 cursor-pointer items-center justify-center rounded text-ctp-overlay0 hover:bg-ctp-surface1 hover:text-ctp-subtext1"
            onClick={(e) => {
              e.stopPropagation();
              onRevert(item.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onRevert(item.id);
              }
            }}
            title="还原此变更"
          >
            <span className="icon-[codicon--discard] text-sm" />
          </button>
        ) : null}
      </span>
    </li>
  );
}
