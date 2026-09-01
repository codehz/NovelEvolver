import type { CommitChangesSnapshot } from "@novelevolver/domain/worktree";
import { useCallback, useEffect, useRef, useState } from "react";

import { useHistory } from "#app/features/project-workbench/session/workspace-handles";

export type CommitChangesCacheEntry =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: CommitChangesSnapshot };

export function useCommitChangesState(commitsRefreshKey: number) {
  const history = useHistory();
  const [expandedHashes, setExpandedHashes] = useState<Set<string>>(() => new Set());
  const [cache, setCache] = useState<Map<string, CommitChangesCacheEntry>>(() => new Map());
  const generationRef = useRef(0);
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  useEffect(() => {
    generationRef.current += 1;
    setExpandedHashes(new Set());
    setCache(new Map());
  }, [commitsRefreshKey]);

  const loadCommitChanges = useCallback(
    (commitHash: string) => {
      const generation = generationRef.current;
      setCache((current) => {
        const next = new Map(current);
        next.set(commitHash, { status: "loading" });
        return next;
      });

      void Promise.resolve(history.listCommitChanges(commitHash))
        .then((snapshot) => {
          if (generation !== generationRef.current) {
            return;
          }
          setCache((current) => {
            const next = new Map(current);
            next.set(commitHash, { status: "ready", snapshot });
            return next;
          });
        })
        .catch((error) => {
          if (generation !== generationRef.current) {
            return;
          }
          setCache((current) => {
            const next = new Map(current);
            next.set(commitHash, {
              status: "error",
              message: error instanceof Error ? error.message : "无法加载提交变更",
            });
            return next;
          });
        });
    },
    [history],
  );

  const toggleExpanded = useCallback(
    (commitHash: string) => {
      const isExpanded = expandedHashes.has(commitHash);
      if (isExpanded) {
        setExpandedHashes((current) => {
          const next = new Set(current);
          next.delete(commitHash);
          return next;
        });
        return;
      }

      setExpandedHashes((current) => {
        const next = new Set(current);
        next.add(commitHash);
        return next;
      });
      const entry = cacheRef.current.get(commitHash);
      if (entry === undefined || entry.status === "error") {
        loadCommitChanges(commitHash);
      }
    },
    [expandedHashes, loadCommitChanges],
  );

  const retry = useCallback(
    (commitHash: string) => {
      loadCommitChanges(commitHash);
    },
    [loadCommitChanges],
  );

  return {
    expandedHashes,
    cache,
    toggleExpanded,
    retry,
  };
}
