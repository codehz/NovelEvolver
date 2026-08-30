import { cn } from "#app/shared/lib/ui/cn";
import type { EntityKind, LeafEntityKind } from "#domain/worktree";
import type { WorktreeSearchHit } from "#domain/worktree";
import type { ManuscriptTreeNode, ResourceTreeNode } from "#domain/worktree";

/** 内容树行图标统一尺寸（16px）与收缩。 */
export const contentTreeIconLayoutClass = cn("shrink-0 text-base");

export function contentFolderIconClass(expanded: boolean): string {
  return cn(
    expanded ? "icon-[codicon--folder-opened]" : "icon-[codicon--folder]",
    "text-ctp-mauve",
    contentTreeIconLayoutClass,
  );
}

export function contentFileLeafIconClass(entityKind: LeafEntityKind): string {
  return cn(
    "text-ctp-blue",
    entityKind === "file" ? "icon-[codicon--file-text]" : "icon-[codicon--book]",
    contentTreeIconLayoutClass,
  );
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
  return contentFileLeafIconClass(entityKind);
}

export function manuscriptTreeNodeIconClass(
  type: ManuscriptTreeNode["type"],
  expanded: boolean,
): string {
  if (type === "folder") {
    return contentFolderIconClass(expanded);
  }
  return contentFileLeafIconClass(type);
}

export function resourceTreeNodeIconClass(
  type: ResourceTreeNode["type"],
  expanded: boolean,
): string {
  if (type === "folder") {
    return contentFolderIconClass(expanded);
  }
  return contentFileLeafIconClass(type);
}

/** 编辑器 Tab 图标：正文章节为 book，资源文件为 file-text，历史/更改对比为 diff。 */
const contentEditorTabIconClassByKind = {
  manuscript: cn(contentFileLeafIconClass("chapter"), "mr-2"),
  resource: cn(contentFileLeafIconClass("file"), "mr-2"),
  comparison: cn("icon-[codicon--diff]", "mr-2 text-ctp-green", contentTreeIconLayoutClass),
} satisfies Record<"manuscript" | "resource" | "comparison", string>;

export function contentEditorTabIconClass(kind: "manuscript" | "resource" | "comparison"): string {
  return contentEditorTabIconClassByKind[kind];
}

/** 编辑器 Tab 默认图标（无自定义 renderIcon 时）。 */
export function contentEditorTabDefaultIconClass(): string {
  return contentEditorTabIconClass("resource");
}
