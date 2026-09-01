import type { WorktreeTransferInput, WorktreeTransferResult } from "@novelevolver/domain/worktree";

import { flushPendingEditorAutosaves } from "#app/features/project-workbench/editor/editor-autosave-flush";
import type { WorkbenchEditorTarget } from "#app/features/project-workbench/editor/state/types";
import { notificationApi } from "#app/shared/lib/notifications";

export async function runExplorerTransfer(options: {
  transfer: (input: WorktreeTransferInput) => Promise<WorktreeTransferResult>;
  input: WorktreeTransferInput;
  openTarget: (target: WorkbenchEditorTarget) => void;
  onSuccess?: (result: WorktreeTransferResult) => void;
}): Promise<WorktreeTransferResult | null> {
  try {
    await flushPendingEditorAutosaves();
    const result = await options.transfer(options.input);
    options.onSuccess?.(result);

    const leafCreates = result.created.filter(
      (item) => item.kind === "chapter" || item.kind === "file",
    );
    if (leafCreates.length === 1) {
      const only = leafCreates[0]!;
      if (only.domain === "manuscript" && only.kind === "chapter") {
        options.openTarget({ kind: "manuscript", chapterId: only.nodeId });
      } else if (only.domain === "resource" && only.kind === "file") {
        options.openTarget({ kind: "resource", resourceId: only.nodeId });
      }
    }

    return result;
  } catch (error) {
    notificationApi.error(error instanceof Error ? error.message : "跨区移动失败", {
      source: options.input.targetDomain === "manuscript" ? "正文" : "资源库",
    });
    return null;
  }
}
