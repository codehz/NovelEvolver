import { cn } from "#app/lib/cn";
import type { EntityKind } from "#shared/rpc/worktree-changes-rpc";
import type { WorktreeSearchHit } from "#shared/rpc/worktree-search-rpc";
import type { ManuscriptTreeNode, ResourceTreeNode } from "#shared/rpc/worktree-tree-rpc";

/** 内容树行图标统一尺寸（16px）与收缩。 */
export const contentTreeIconLayoutClass = cn("shrink-0 text-base");

export function contentFolderIconClass(expanded: boolean): string {
  return cn(
    expanded ? "icon-[codicon--folder-opened]" : "icon-[codicon--folder]",
    "text-ctp-mauve",
    contentTreeIconLayoutClass,
  );
}

export function contentFileLeafIconClass(): string {
  return cn("icon-[codicon--file-text] text-ctp-blue", contentTreeIconLayoutClass);
}

export function contentDomainIconClass(domain: "manuscript" | "resource"): string {
  return cn(
    domain === "manuscript" ? "icon-[codicon--book]" : "icon-[codicon--library]",
    "text-ctp-mauve",
    contentTreeIconLayoutClass,
  );
}

export function contentEntityIconClass(
  entityKind: EntityKind | WorktreeSearchHit["entityKind"],
  options?: { folderExpanded?: boolean },
): string {
  if (entityKind === "folder") {
    return contentFolderIconClass(options?.folderExpanded ?? false);
  }
  return contentFileLeafIconClass();
}

export function manuscriptTreeNodeIconClass(
  type: ManuscriptTreeNode["type"],
  expanded: boolean,
): string {
  if (type === "folder") {
    return contentFolderIconClass(expanded);
  }
  return contentFileLeafIconClass();
}

export function resourceTreeNodeIconClass(
  type: ResourceTreeNode["type"],
  expanded: boolean,
): string {
  if (type === "folder") {
    return contentFolderIconClass(expanded);
  }
  return contentFileLeafIconClass();
}

/** 编辑器 Tab 默认图标（无自定义 renderIcon 时）。 */
export function contentEditorTabDefaultIconClass(): string {
  return cn(contentFileLeafIconClass(), "mr-2");
}
