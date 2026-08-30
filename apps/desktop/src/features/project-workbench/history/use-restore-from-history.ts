import { useCallback } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import { notificationApi } from "#app/shared/lib/notifications";
import type { CommitSummary, HistoryEntry, HistoryTarget } from "#domain/worktree";
import { useHistory } from "#workbench/session/workspace-handles";

export function useRestoreFromHistory() {
  const history = useHistory();

  const restoreWorkingTreeFromCommit = useCallback(
    async (commit: CommitSummary): Promise<boolean> => {
      const confirmed = await confirmDialogApi.confirm({
        title: "恢复工作区到此提交",
        description: `将用提交 ${commit.shortHash} 的内容覆盖当前未提交草稿。分支 tip 不会移动，之后可在「更改」中查看差异，也可还原全部更改回到 tip。`,
        confirmLabel: "恢复工作区",
        tone: "danger",
      });
      if (!confirmed) {
        return false;
      }
      try {
        await Promise.resolve(history.restoreWorkingTreeFromCommit(commit.hash));
        notificationApi.info(`已恢复工作区到提交 ${commit.shortHash}`, { source: "历史" });
        return true;
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "恢复工作区失败", {
          source: "历史",
        });
        return false;
      }
    },
    [history],
  );

  const restoreEntityFromCommit = useCallback(
    async (commit: CommitSummary, target: HistoryTarget, label?: string): Promise<boolean> => {
      const confirmed = await confirmDialogApi.confirm({
        title: "恢复此文件到提交版本",
        description: `将「${label ?? target.entityId}」恢复为提交 ${commit.shortHash} 中的内容，覆盖当前草稿中的对应文件。分支 tip 不会移动。`,
        confirmLabel: "恢复文件",
        tone: "danger",
      });
      if (!confirmed) {
        return false;
      }
      try {
        await Promise.resolve(history.restoreEntityFromCommit(commit.hash, target));
        notificationApi.info(`已恢复文件至提交 ${commit.shortHash}`, { source: "历史" });
        return true;
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "恢复文件失败", {
          source: "历史",
        });
        return false;
      }
    },
    [history],
  );

  const restoreEntityFromHistoryEntry = useCallback(
    async (entry: HistoryEntry): Promise<boolean> => {
      if (!entry.hasContent) {
        notificationApi.error("此记录没有可恢复内容。", { source: "历史" });
        return false;
      }
      const confirmed = await confirmDialogApi.confirm({
        title: "恢复此历史版本",
        description: `将「${entry.label}」恢复为该历史记录中的内容，覆盖当前草稿。分支 tip 不会移动。`,
        confirmLabel: "恢复版本",
        tone: "danger",
      });
      if (!confirmed) {
        return false;
      }
      try {
        await Promise.resolve(history.restoreEntityFromHistoryEntry(entry.id));
        notificationApi.info("已恢复历史版本到工作区", { source: "历史" });
        return true;
      } catch (error) {
        notificationApi.error(error instanceof Error ? error.message : "恢复历史版本失败", {
          source: "历史",
        });
        return false;
      }
    },
    [history],
  );

  const copyCommitHash = useCallback(async (commit: CommitSummary): Promise<void> => {
    try {
      await navigator.clipboard.writeText(commit.hash);
      notificationApi.info(`已复制 ${commit.shortHash}`, { source: "历史" });
    } catch (error) {
      notificationApi.error(error instanceof Error ? error.message : "复制失败", {
        source: "历史",
      });
    }
  }, []);

  return {
    restoreWorkingTreeFromCommit,
    restoreEntityFromCommit,
    restoreEntityFromHistoryEntry,
    copyCommitHash,
  };
}
