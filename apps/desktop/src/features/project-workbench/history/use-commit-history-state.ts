import type { CommitSummary } from "@novelevolver/domain/worktree";
import { useCallback, useEffect, useState } from "react";

import { useHistory } from "#app/features/project-workbench/session/workspace-handles";

import { HISTORY_MAX_COMMITS } from "./constants";

export function useCommitHistoryState(commitsRefreshKey: number) {
  const history = useHistory();
  const [commits, setCommits] = useState<CommitSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError(false);

    void Promise.resolve(history.listCommits(HISTORY_MAX_COMMITS))
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
  }, [commitsRefreshKey, history, retryKey]);

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
