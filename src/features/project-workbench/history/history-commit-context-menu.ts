import type { ContextMenuItem } from "#app/shared/lib/context-menu";

export function buildHistoryCommitContextMenuItems(): ContextMenuItem[] {
  return [{ id: "create-branch", label: "从此提交创建分支…" }];
}
