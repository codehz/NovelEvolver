import type { ReactNode } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import type { FileChangeStatus } from "#shared/rpc/worktree-tree-rpc";

export type TreeRowChangeKind = "folder" | "chapter" | "file";

export function treeChangeStatusIconClass(
  status: FileChangeStatus | undefined,
  rowType: TreeRowChangeKind,
): string | undefined {
  if (!status) {
    return undefined;
  }
  if (rowType === "folder") {
    return cn("icon-[codicon--circle-filled] text-ctp-yellow/45");
  }
  return cn(
    status === "added" && "icon-[codicon--diff-added] text-ctp-green",
    status === "modified" && "icon-[codicon--diff-modified] text-ctp-yellow",
  );
}

export function treeChangeStatusLabelClass(
  status: FileChangeStatus | undefined,
  rowType: TreeRowChangeKind,
): string | undefined {
  if (!status) {
    return undefined;
  }
  if (rowType === "folder") {
    return cn("text-ctp-yellow");
  }
  return cn(status === "added" && "text-ctp-green", status === "modified" && "text-ctp-yellow");
}

export function TreeChangeStatusBadge({
  status,
  rowType,
  className,
}: {
  status: FileChangeStatus;
  rowType: TreeRowChangeKind;
  className?: string;
}): ReactNode {
  const iconClass = treeChangeStatusIconClass(status, rowType);
  if (!iconClass) {
    return null;
  }
  return (
    <span className={cn("ml-auto shrink-0 text-sm", iconClass, className)} aria-hidden="true" />
  );
}
