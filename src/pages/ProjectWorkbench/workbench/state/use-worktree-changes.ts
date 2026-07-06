import { useCallback, useEffect, useState } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { Change, ChangesSnapshot, WorktreeChangesEvent } from "#shared/rpc/worktree-changes";

import { useWorktreeChanges } from "../branch/branch-scopes";
import { SCM_COMMIT_AUTHOR } from "../scm/constants";

export function useWorktreeChangesState() {
  const changesHandle = useWorktreeChanges();
  const [result, setResult] = useState<ChangesSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitsRefreshKey, setCommitsRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    return consumeRpcStream<WorktreeChangesEvent>({
      subscribe: () => changesHandle.subscribe(),
      onValue: (event) => {
        if (event.kind === "snapshot") {
          setResult(event.snapshot);
          setLoading(false);
          return;
        }
        // 处理增量更新
        setResult((previous) => {
          if (previous === null) {
            return null;
          }
          const { delta } = event;
          const removedChangeIds = new Set(delta.removedChangeIds);

          // 过滤掉已删除的变更
          const manuscriptChanges = previous.manuscriptChanges.filter(
            (c) => !removedChangeIds.has(c.id),
          );
          const resourceChanges = previous.resourceChanges.filter(
            (c) => !removedChangeIds.has(c.id),
          );

          // 添加新的变更
          for (const change of delta.addedChanges) {
            if (change.domain === "manuscript") {
              manuscriptChanges.push(change);
            } else {
              resourceChanges.push(change);
            }
          }

          return {
            ...previous,
            revision: delta.toRevision,
            manuscriptChanges,
            resourceChanges,
            hasChanges: manuscriptChanges.length > 0 || resourceChanges.length > 0,
          };
        });
        setLoading(false);
      },
      onError: () => {
        setError(true);
        setLoading(false);
      },
      cancelReason: "Changes subscription disposed.",
    });
  }, [changesHandle, retryKey]);

  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  const revertChange = useCallback(
    (changeId: string) => {
      changesHandle
        .revertChange(changeId)
        .then((updated) => {
          setResult(updated);
        })
        .catch(() => {
          setError(true);
        });
    },
    [changesHandle],
  );

  const commit = useCallback(() => {
    const message = commitMessage.trim();
    if (message === "" || committing) return;

    setCommitting(true);
    changesHandle
      .commit(message, SCM_COMMIT_AUTHOR)
      .then((updated) => {
        setResult(updated);
        setCommitMessage("");
        setCommitting(false);
        setCommitsRefreshKey((current) => current + 1);
      })
      .catch(() => {
        setCommitting(false);
        setError(true);
      });
  }, [changesHandle, commitMessage, committing]);

  const listCommits = useCallback(
    (maxCount?: number) => {
      return changesHandle.listCommits(maxCount);
    },
    [changesHandle],
  );

  return {
    commit,
    commitMessage,
    committing,
    commitsRefreshKey,
    error,
    loading,
    result,
    retry,
    revertChange,
    setCommitMessage,
    listCommits,
  };
}

/**
 * 获取所有变更的扁平化列表
 */
export function useAllChanges(): Change[] {
  const { result } = useWorktreeChangesState();
  if (result === null) {
    return [];
  }
  return [...result.manuscriptChanges, ...result.resourceChanges];
}

/**
 * 获取变更统计
 */
export function useChangesStats() {
  const { result } = useWorktreeChangesState();
  if (result === null) {
    return { total: 0, manuscript: 0, resource: 0 };
  }
  return {
    total: result.manuscriptChanges.length + result.resourceChanges.length,
    manuscript: result.manuscriptChanges.length,
    resource: result.resourceChanges.length,
  };
}

/**
 * 获取文件夹的变更统计（聚合子项变更）
 */
export function useFolderChangeStats(folderId: string) {
  const { result } = useWorktreeChangesState();
  if (result === null) {
    return { count: 0, added: 0, removed: 0, modified: 0 };
  }

  const allChanges = [...result.manuscriptChanges, ...result.resourceChanges];
  const folderChanges = allChanges.filter((change) => {
    // 检查变更是否在文件夹内（通过displayPath前缀匹配）
    const folderPath = folderId === "root" ? "" : folderId;
    if (folderPath === "") {
      return true; // 根文件夹包含所有变更
    }
    return change.displayPath.startsWith(`${folderPath}/`);
  });

  const stats = {
    count: folderChanges.length,
    added: folderChanges.filter((c) => c.kind === "create").length,
    removed: folderChanges.filter((c) => c.kind === "delete").length,
    modified: folderChanges.filter(
      (c) =>
        c.kind === "content" || c.kind === "rename" || c.kind === "move" || c.kind === "reorder",
    ).length,
  };

  return stats;
}

/**
 * 获取实体的变更状态（用于资源管理器显示）
 */
export function useEntityChangeStatus(entityId: string, domain: "manuscript" | "resource") {
  const { result } = useWorktreeChangesState();
  if (result === null) {
    return null;
  }

  const changes = domain === "manuscript" ? result.manuscriptChanges : result.resourceChanges;
  const entityChanges = changes.filter((c) => c.entityId === entityId);

  if (entityChanges.length === 0) {
    return null;
  }

  // 如果有create变更，返回added
  if (entityChanges.some((c) => c.kind === "create")) {
    return "added";
  }

  // 否则返回modified
  return "modified";
}
