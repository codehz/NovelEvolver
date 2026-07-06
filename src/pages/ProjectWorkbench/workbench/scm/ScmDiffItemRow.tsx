import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "#app/lib/cn";
import {
  treeRowDisclosureChevronSlotClass,
  treeRowDisclosureSpacerClass,
} from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/workbench/tree/TreeMotionRow";
import type { Change } from "#shared/rpc/worktree-changes";

import { ScmDiffStats } from "./ScmDiffStats";

function scmChangeKindIconClass(kind: Change["kind"]): string {
  return cn(
    kind === "create" && "icon-[codicon--diff-added] text-ctp-green",
    kind === "delete" && "icon-[codicon--diff-removed] text-ctp-red",
    kind === "content" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "rename" && "icon-[codicon--edit] text-ctp-yellow",
    kind === "move" && "icon-[codicon--diff-modified] text-ctp-yellow",
    kind === "reorder" && "icon-[codicon--list-flat] text-ctp-subtext0",
  );
}

function scmEntityIconClass(entityKind: Change["entityKind"]): string {
  return cn(
    entityKind === "chapter" && "icon-[codicon--book] text-ctp-blue",
    entityKind === "folder" && "icon-[codicon--folder] text-ctp-mauve",
    entityKind === "file" && "icon-[codicon--file] text-ctp-overlay0",
  );
}

const scmChangeRowClass = cn(
  "group cursor-default text-xs text-ctp-subtext1 hover:bg-ctp-surface0/50",
);
const scmChangeMetaClass = cn("ml-auto flex shrink-0 items-center gap-1");
const scmChangeMetaIdleClass = cn(
  "flex shrink-0 items-center gap-1 group-focus-within:hidden group-hover:hidden",
);
const scmChangeRevertButtonClass = cn(
  "hidden size-5 shrink-0 cursor-pointer items-center justify-center text-ctp-overlay0",
  "group-focus-within:flex group-hover:flex hover:bg-ctp-surface1 hover:text-ctp-subtext1",
);

function disclosureChevron(expanded: boolean): ReactNode {
  return (
    <span
      aria-hidden="true"
      className={cn(
        treeRowDisclosureChevronSlotClass,
        "icon-[codicon--chevron-right]",
        "motion-safe:transition-transform motion-safe:duration-220 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
        expanded && "rotate-90",
      )}
    />
  );
}

export function ScmDiffItemRow({
  item,
  depth,
  layout,
  label,
  disclosure,
  iconClassName,
  className,
  ariaExpanded,
  onClick,
  onKeyDown,
  onRevert,
}: {
  item: Change;
  depth: number;
  layout: { y: number; height: number; animateEnter: boolean };
  label?: string;
  disclosure?: ReactNode;
  iconClassName?: string;
  className?: string;
  ariaExpanded?: boolean;
  onClick?: () => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onRevert: (changeId: string) => void;
}) {
  return (
    <TreeMotionRow
      y={layout.y}
      height={layout.height}
      animateEnter={layout.animateEnter}
      depth={depth}
      className={cn(scmChangeRowClass, className)}
      aria-expanded={ariaExpanded}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {disclosure ?? <span className={treeRowDisclosureSpacerClass} />}
      <span
        className={cn(iconClassName ?? scmEntityIconClass(item.entityKind), "shrink-0 text-sm")}
      />
      <span className="truncate">{label ?? item.label}</span>
      {item.kind === "reorder" ? (
        <span className="shrink-0 text-[10px] text-ctp-overlay0">顺序</span>
      ) : null}
      <span className={scmChangeMetaClass}>
        <span className={scmChangeMetaIdleClass}>
          {item.stats !== undefined ? (
            <ScmDiffStats added={item.stats.added} removed={item.stats.removed} />
          ) : null}
          <span className={cn(scmChangeKindIconClass(item.kind), "shrink-0 text-sm")} />
        </span>
        <button
          type="button"
          className={scmChangeRevertButtonClass}
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
      </span>
    </TreeMotionRow>
  );
}

export { disclosureChevron, scmEntityIconClass };
