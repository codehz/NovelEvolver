import { quickPickApi } from "#app/shared/lib/quick-pick";
import type { BranchSummary } from "#shared/rpc/session/index";

import { getBranchNameValidationError, normalizeBranchNameInput } from "./branch-data";

export type PromptNewBranchNameOptions = {
  existing: BranchSummary[];
  /** 预填输入（例如分支切换器搜索词）。 */
  initialValue?: string;
  /** 输入框 hint；默认「从当前 tip 创建」。 */
  hint?: string;
};

/**
 * 弹出分支名输入；用户取消时由 quickPick 抛 isQuickPickDismissedError。
 * 返回规范化后的分支名。
 */
export async function promptNewBranchName(options: PromptNewBranchNameOptions): Promise<string> {
  const {
    existing,
    initialValue = "",
    hint = "将从当前分支 tip 创建，并自动切换到新分支",
  } = options;
  return normalizeBranchNameInput(
    await quickPickApi.showInput({
      title: "创建分支",
      inputLabel: "分支名",
      placeholder: "输入新分支名称…",
      initialValue: normalizeBranchNameInput(initialValue),
      hint,
      dismissAriaLabel: "取消创建分支",
      validate: (raw) => getBranchNameValidationError(normalizeBranchNameInput(raw), existing),
    }),
  );
}
