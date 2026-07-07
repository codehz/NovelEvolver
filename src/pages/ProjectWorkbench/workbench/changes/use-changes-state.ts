import { useCallback, useEffect, useState } from "react";

import { consumeRpcSubscription } from "#app/lib/app-rpc-react";
import type { ChangesSnapshot } from "#shared/rpc/worktree-changes-rpc";

import { useHistory, useWorktreeChanges } from "../branch/branch-scopes";
import { APP_COMMIT_AUTHOR } from "./constants";

export function useChangesState() {
  const changesHandle = useWorktreeChanges();
  const history = useHistory();
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
    return consumeRpcSubscription({
      subscribe: () => changesHandle.subscribeChanges(),
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
      .commit(message, APP_COMMIT_AUTHOR)
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

  const listCommits = useCallback((maxCount?: number) => history.listCommits(maxCount), [history]);

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
