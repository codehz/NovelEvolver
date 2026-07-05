import { useCallback, useEffect, useState } from "react";

import { consumeRpcStream } from "#app/lib/app-rpc-react";
import type { ScmSnapshot } from "#shared/rpc/worktree-scm";

import { useWorktreeScm } from "../branch/branch-scopes";
import { SCM_COMMIT_AUTHOR } from "./constants";

export function useScmChangesState() {
  const scmHandle = useWorktreeScm();
  const [result, setResult] = useState<ScmSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitsRefreshKey, setCommitsRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(false);
    return consumeRpcStream({
      subscribe: () => scmHandle.subscribeSnapshot(),
      onValue: (snapshot) => {
        setResult(snapshot);
        setLoading(false);
      },
      onError: () => {
        setError(true);
        setLoading(false);
      },
      cancelReason: "SCM subscription disposed.",
    });
  }, [scmHandle, retryKey]);

  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  const revertChange = useCallback(
    (changeId: string) => {
      scmHandle
        .revertChange(changeId)
        .then((updated) => {
          setResult(updated);
        })
        .catch(() => {
          setError(true);
        });
    },
    [scmHandle],
  );

  const commit = useCallback(() => {
    const message = commitMessage.trim();
    if (message === "" || committing) return;

    setCommitting(true);
    scmHandle
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
  }, [scmHandle, commitMessage, committing]);

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
  };
}
