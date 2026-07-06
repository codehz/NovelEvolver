import { useCallback, useEffect, useState } from "react";

import { useWorktreeChanges } from "../branch/branch-scopes";
import { SCM_GRAPH_MAX_COMMITS } from "./constants";

export function useScmGraphState(commitsRefreshKey: number) {
  const changesHandle = useWorktreeChanges();
  const [commits, setCommits] = useState<Array<{
    hash: string;
    shortHash: string;
    message: string;
    authorName: string;
    committedAt: number;
  }> | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(false);

    void Promise.resolve(changesHandle.listCommits(SCM_GRAPH_MAX_COMMITS))
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
  }, [changesHandle, commitsRefreshKey, retryKey]);

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
