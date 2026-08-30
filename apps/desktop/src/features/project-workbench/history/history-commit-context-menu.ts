import type { ContextMenuItem } from "#app/shared/lib/context-menu";

export function buildHistoryCommitContextMenuItems(): ContextMenuItem[] {
  return [
    { id: "restore-working-tree", label: "恢复工作区到此提交…" },
    { id: "create-branch", label: "从此提交创建分支…" },
    { type: "separator" },
    { id: "copy-hash", label: "复制提交哈希" },
  ];
}

export function buildHistoryChangeContextMenuItems(): ContextMenuItem[] {
  return [
    { id: "open-diff", label: "打开差异预览" },
    { id: "restore-entity", label: "恢复此文件到提交版本…" },
  ];
}

export function buildFileHistoryEntryContextMenuItems(hasContent: boolean): ContextMenuItem[] {
  return [
    { id: "open-preview", label: "打开对比预览", enabled: hasContent },
    { id: "restore-entry", label: "恢复此版本到工作区…", enabled: hasContent },
  ];
}
