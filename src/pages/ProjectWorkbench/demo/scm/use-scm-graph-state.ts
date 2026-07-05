import { useCallback, useEffect, useState } from "react";

import type { ScmCommitSummary } from "#shared/rpc/worktree-scm";

import { useWorktreeScm } from "../branch/branch-scopes";
import { SCM_GRAPH_MAX_COMMITS } from "./constants";

export function useScmGraphState(commitsRefreshKey: number) {
  const scmHandle = useWorktreeScm();
  const [commits, setCommits] = useState<ScmCommitSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(false);

    void Promise.resolve(scmHandle.listCommits(SCM_GRAPH_MAX_COMMITS))
      .then((list) => {
        if (!canceled) {
          setCommits(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!canceled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [scmHandle, commitsRefreshKey, retryKey]);

  const retry = useCallback(() => {
    setRetryKey((current) => current + 1);
  }, []);

  return {
    commits,
    error,
    loading,
    retry,
  };
}
