import { useMolecule } from "bunshi/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";

import { confirmDialogApi } from "#app/shared/lib/confirm-dialog";
import type { ChangesSnapshot } from "#domain/worktree";
import { worktreeChangesFeedMolecule } from "#workbench/session/changes-feed/worktree-changes-feed";
import { useHistory, useWorktreeChanges } from "#workbench/session/workspace-handles";

import { APP_COMMIT_AUTHOR } from "./constants";

export function useChangesState() {
  const changesHandle = useWorktreeChanges();
  const history = useHistory();
  const { feedAtom, changesSnapshotAtom, statusAtom, retryKeyAtom } = useMolecule(
    worktreeChangesFeedMolecule,
  );
  const result = useAtomValue(changesSnapshotAtom);
  const status = useAtomValue(statusAtom);
  const setFeed = useSetAtom(feedAtom);
  const setRetryKey = useSetAtom(retryKeyAtom);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [revertingAll, setRevertingAll] = useState(false);
  const [commitsRefreshKey, setCommitsRefreshKey] = useState(0);

  const loading = status === "loading";
  const canRevertAll = result?.hasChanges === true && !loading && !revertingAll;

  const applyLocalSnapshot = useCallback(
    (updated: ChangesSnapshot) => {
      setFeed((current) => ({
        ...current,
        status: "ready",
        revision: updated.revision,
        changesSnapshot: updated,
      }));
    },
    [setFeed],
  );

  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, [setRetryKey]);

  const revertChange = useCallback(
    (changeId: string) => {
      changesHandle
        .revertChange(changeId)
        .then((updated) => {
          applyLocalSnapshot(updated);
        })
        .catch(() => {
          setFeed((current) => ({
            ...current,
            status: "error",
          }));
        });
    },
    [applyLocalSnapshot, changesHandle, setFeed],
  );

  const revertAll = useCallback(async () => {
    if (!canRevertAll) {
      return;
    }

    const confirmed = await confirmDialogApi.confirm({
      title: "还原所有更改",
      description: "将丢弃当前工作区全部未提交修改，恢复到上次提交状态。此操作不可撤销。",
      confirmLabel: "还原全部",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setRevertingAll(true);
    try {
      const updated = await changesHandle.revertAllChanges();
      applyLocalSnapshot(updated);
    } catch {
      setFeed((current) => ({
        ...current,
        status: "error",
      }));
    } finally {
      setRevertingAll(false);
    }
  }, [applyLocalSnapshot, canRevertAll, changesHandle, setFeed]);

  const commit = useCallback(() => {
    const message = commitMessage.trim();
    if (message === "" || committing) return;

    setCommitting(true);
    changesHandle
      .commit(message, APP_COMMIT_AUTHOR)
      .then((updated) => {
        applyLocalSnapshot(updated);
        setCommitMessage("");
        setCommitting(false);
        setCommitsRefreshKey((current) => current + 1);
      })
      .catch(() => {
        setCommitting(false);
        setFeed((current) => ({
          ...current,
          status: "error",
        }));
      });
  }, [applyLocalSnapshot, changesHandle, commitMessage, committing, setFeed]);

  const listCommits = useCallback((maxCount?: number) => history.listCommits(maxCount), [history]);

  const invalidateCommits = useCallback(() => {
    setCommitsRefreshKey((current) => current + 1);
  }, []);

  return {
    canRevertAll,
    commit,
    commitMessage,
    committing,
    commitsRefreshKey,
    error: status === "error",
    invalidateCommits,
    loading,
    result,
    retry,
    revertAll,
    revertChange,
    revertingAll,
    setCommitMessage,
    listCommits,
  };
}
