import type { KeyboardEvent, ReactNode } from "react";

import { cn } from "#app/lib/cn";
import {
  getTreeRowPaddingLeft,
  treeRowDisclosureChevronSlotClass,
} from "#app/pages/ProjectWorkbench/workbench/tree/tree-row-motion";
import { TreeMotionRow } from "#app/pages/ProjectWorkbench/workbench/tree/TreeMotionRow";

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

function activateOnEnterSpace(onActivate: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };
}

const scmGroupCountClass = cn(
  "ml-auto shrink-0 bg-ctp-surface0 px-1 py-px font-mono text-[10px] text-ctp-subtext0",
);
const scmGroupRowClass = cn(
  "cursor-pointer text-xs font-medium text-ctp-text hover:bg-ctp-surface0/50",
);

export function ScmDomainRow({
  title,
  iconClass,
  expanded,
  childCount,
  layout,
  onToggle,
}: {
  title: string;
  iconClass: string;
  expanded: boolean;
  childCount: number;
  layout: { y: number; height: number; animateEnter: boolean };
  onToggle: () => void;
}) {
  return (
    <TreeMotionRow
      y={layout.y}
      height={layout.height}
      animateEnter={layout.animateEnter}
      depth={0}
      paddingLeftPx={getTreeRowPaddingLeft(0)}
      className={scmGroupRowClass}
      aria-expanded={expanded}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={activateOnEnterSpace(onToggle)}
    >
      {disclosureChevron(expanded)}
      <span className={cn(iconClass, "shrink-0 text-sm")} />
      <span className="truncate">{title}</span>
      <span className={scmGroupCountClass}>{childCount}</span>
    </TreeMotionRow>
  );
}
